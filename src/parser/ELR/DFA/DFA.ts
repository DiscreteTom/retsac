import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ASTNode } from "../../ast";
import type { ParserOutput } from "../../output";
import { rejectedParserOutput } from "../../output";
import type { GrammarRule, ReLexStack, RollbackStack } from "../model";
import { GrammarRepo, ReadonlyGrammarRuleRepo, GrammarSet } from "../model";
import type { ReadonlyCandidateRepo } from "./candidate";
import { CandidateRepo } from "./candidate";
import type {
  ReadonlyFirstSets,
  ReadonlyFollowSets,
} from "./first-follow-sets";
import type { ReadonlyStateRepo, State } from "./state";
import { StateRepo } from "./state";
import { stringMap2serializable, serializable2map } from "./utils";

/**
 * DFA for ELR parsers. Stateless.
 */
export class DFA<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  constructor(
    readonly grammarRules: ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >,
    private readonly entryNTs: ReadonlySet<Kinds>,
    private readonly entryState: State<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    private readonly NTClosures: ReadonlyMap<
      Kinds,
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
    >,
    // TODO: remove this? this is not used during runtime
    // maybe other vars are not used too?
    public readonly firstSets: ReadonlyFirstSets<Kinds, LexerKinds>,
    public readonly followSets: ReadonlyFollowSets<Kinds | LexerKinds>,
    private readonly candidates: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    readonly states: ReadonlyStateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    readonly grammars: GrammarRepo<Kinds | LexerKinds>,
    readonly NTs: ReadonlySet<Kinds>,
    private readonly cascadeQueryPrefix: string | undefined,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
    public debug: boolean,
    public logger: Logger,
  ) {}

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    lexer: ILexer<LexerError, LexerKinds>,
    reLexStack: ReLexStack<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    rollbackStack: RollbackStack<ASTData, ErrorType, Kinds, LexerKinds>,
    commitParser: () => void,
    stopOnError = false,
  ): {
    output: ParserOutput<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<LexerError, LexerKinds>;
  } {
    // reset state stack with entry state
    /**
     * Current state is `states.at(-1)`.
     */
    let stateStack = [this.entryState];

    let index = 0; // buffer index
    let errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[] = [];

    /**
     * Before reLex, make sure the reLexStack is not empty!
     */
    const reLex = () => {
      const state = reLexStack.pop()!;

      // rollback
      if (this.rollback) {
        while (rollbackStack.length > state.rollbackStackLength) {
          const { context, rollback } = rollbackStack.pop()!;
          rollback?.(context);
        }
      }

      // apply state
      stateStack = state.stateStack;
      buffer = state.buffer;
      lexer = state.lexer;
      index = state.index;
      errors = state.errors;

      if (this.debug)
        this.logger(
          `[Re-Lex] Restored input: "${
            // restored input
            state.buffer.at(-1)!.text +
            state.lexer
              .getRest()
              .slice(0, lexer.digested - state.lexer.digested)
          }" Trying: ${buffer.at(-1)}`,
        );
    };

    while (true) {
      if (index >= buffer.length) {
        // end of buffer, try to lex input string to get next ASTNode
        const res = stateStack.at(-1)!.tryLex(lexer, this.followSets);
        // if no more ASTNode can be lexed
        if (res.length == 0) {
          // try to restore from re-lex stack
          if (this.reLex && reLexStack.length > 0) {
            reLex();
          } else {
            // no more ASTNode can be lexed, parsing failed
            if (this.debug)
              this.logger(
                `[End] No matching token can be lexed. Rest of input: ${lexer.buffer.slice(
                  lexer.digested,
                  lexer.digested + 10,
                )}\nCandidates:\n${stateStack.at(-1)!.str}`,
              );
            return { output: rejectedParserOutput, lexer };
          }
        } else {
          // lex success, record all possible lexing results for later use
          // we need to append reLexStack reversely, so that the first lexing result is at the top of the stack
          if (this.reLex) {
            for (let i = res.length - 1; i >= 0; --i) {
              reLexStack.push({
                stateStack: stateStack.slice(), // make a copy
                buffer: buffer.slice().concat(res[i].node),
                lexer: res[i].lexer,
                index,
                errors: errors.slice(),
                rollbackStackLength: rollbackStack.length,
              });
            }
            // use the first lexing result to continue parsing
            const state = reLexStack.pop()!;
            buffer = state.buffer;
            lexer = state.lexer;
          }
        }
      }

      // try to construct next state
      const nextStateResult = stateStack
        .at(-1)!
        .getNext(this.grammars, buffer[index]);
      if (nextStateResult.state == null) {
        // try to restore from re-lex stack
        if (this.reLex && reLexStack.length > 0) {
          reLex();
          continue;
        } else {
          // no more candidate can be constructed, parsing failed
          if (this.debug)
            this.logger(
              `[End] No more candidate. Node=${buffer.at(-1)} Candidates:\n${
                stateStack.at(-1)!.str
              }`,
            );
          return { output: rejectedParserOutput, lexer };
        }
      }

      // next state exist, push stack
      stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const res = stateStack
        .at(-1)!
        .tryReduce(
          buffer,
          this.entryNTs,
          this.followSets,
          lexer,
          this.cascadeQueryPrefix,
          this.debug,
          this.logger,
        );
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      if (res.commit) {
        commitParser();
      } else {
        // update rollback stack
        if (this.rollback)
          rollbackStack.push({ rollback: res.rollback, context: res.context });
      }
      const reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.push(...res.errors);
      for (let i = 0; i < reduced; ++i) stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (this.entryNTs.has(buffer[0].kind as Kinds) && index == 0)
        return { output: { accept: true, buffer, errors }, lexer };
      // if stop on error, return partial result
      if (stopOnError && errors.length > 0)
        return { output: { accept: true, buffer, errors }, lexer };

      // continue loop, try to digest more with the newly reduced buffer
    }
  }

  toJSON() {
    return {
      NTs: [...this.NTs],
      entryNTs: [...this.entryNTs],
      grammars: this.grammars.toJSON(),
      grammarRules: this.grammarRules.toJSON(this.grammars),
      candidates: this.candidates.toJSON(this.grammarRules, this.grammars),
      states: this.states.toJSON(this.candidates, this.grammars),
      entryState: this.states.getKey(this.entryState),
      NTClosures: stringMap2serializable(this.NTClosures, (grs) =>
        grs.map((gr) => this.grammarRules.getKey(gr)),
      ),
      firstSets: stringMap2serializable(this.firstSets, (v) =>
        v.toJSON(this.grammars),
      ),
      followSets: stringMap2serializable(this.followSets, (v) =>
        v.toJSON(this.grammars),
      ),
      cascadeQueryPrefix: this.cascadeQueryPrefix,
    };
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: ReturnType<
      DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>["toJSON"]
    >,
    options: {
      logger: Logger;
      debug: boolean;
      rollback: boolean;
      reLex: boolean;
    },
  ) {
    const NTs = new Set(data.NTs);
    const grammars = GrammarRepo.fromJSON(data.grammars);
    const grs = ReadonlyGrammarRuleRepo.fromJSON<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >(data.grammarRules, grammars);
    const candidates = CandidateRepo.fromJSON<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >(data.candidates, grs, grammars);
    const states = StateRepo.fromJSON(data.states, candidates, grammars);
    const firstSets = serializable2map(data.firstSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFirstSets<Kinds, LexerKinds>;
    const followSets = serializable2map(data.followSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFollowSets<Kinds | LexerKinds>;
    const NTClosures = serializable2map(data.NTClosures, (v) =>
      v.map((s) => grs.getByString(s)!),
    );
    const entryState = states.getByString(data.entryState)!;
    return new DFA(
      grs,
      new Set(data.entryNTs),
      entryState,
      NTClosures,
      firstSets,
      followSets,
      candidates,
      states,
      grammars,
      NTs,
      data.cascadeQueryPrefix,
      options.rollback,
      options.reLex,
      options.debug,
      options.logger,
    );
  }

  toMermaid() {
    // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
    const hashCode = (s: string) =>
      s.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
    const hashStr = (s: string) => {
      // use 36 radix to reduce length
      // raw may starts with '-' if negative
      const raw = hashCode(s).toString(36);
      // use p/n as prefix to avoid starting with number or contains '-'
      return raw.startsWith("-") ? raw.replace("-", "n") : "p" + raw;
    };
    const escapeStateDescription = (s: string) =>
      // escape quote and newline
      `"${s.replace(/"/g, "&quot;").replace(/\n/g, "\\n")}"`;
    const escapeTransition = (s: string) =>
      `${s.replace(/./g, (i) => "#" + i.charCodeAt(0) + ";")}`;

    const res = [
      `stateDiagram-v2`,
      "direction LR",
      `[*] --> ${hashStr(this.entryState.str)}`, // entry state
    ];

    // push states & transitions
    this.states.states.forEach((c) =>
      res.push(c.toMermaid(hashStr, escapeStateDescription, escapeTransition)),
    );

    return res.join("\n");
  }
}
