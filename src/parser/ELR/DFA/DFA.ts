import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ASTNode } from "../../ast";
import type { ParserOutput } from "../../output";
import { rejectedParserOutput } from "../../output";
import type { GrammarRule } from "../model";
import { GrammarRepo, ReadonlyGrammarRuleRepo, GrammarSet } from "../model";
import type { ParsingState, ReLexState, RollbackState } from "../model";
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
      LexerKinds,
      LexerError
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
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
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
    public readonly ignoreEntryFollow: boolean,
    public readonly reParse: boolean,
    public debug: boolean,
    public logger: Logger,
  ) {}

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    lexer: ILexer<LexerError, LexerKinds>,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    commitParser: () => void,
    stopOnError: boolean,
  ): {
    output: ParserOutput<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<LexerError, LexerKinds>;
  } {
    return this._parse(
      {
        stateStack: [this.entryState],
        index: 0,
        errors: [],
        buffer,
        lexer,
      },
      reLexStack,
      rollbackStack,
      commitParser,
      stopOnError,
    );
  }

  private reLexFactory(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
  ) {
    return () => {
      const targetState = reLexStack.pop()!;

      if (this.debug)
        this.logger(
          `[Re-Lex] Restored input: "${
            // restored input
            targetState.buffer.at(-1)!.text +
            targetState.lexer.buffer.slice(
              targetState.lexer.digested,
              parsingState.lexer.digested,
            )
          }" Trying: ${targetState.buffer.at(-1)}`,
        );

      // call rollbacks if rollback is enabled
      if (this.rollback) {
        while (rollbackStack.length > targetState.rollbackStackLength) {
          const { context, rollback } = rollbackStack.pop()!;
          rollback?.(context);
        }
      }

      // apply state
      parsingState.stateStack = targetState.stateStack;
      parsingState.buffer = targetState.buffer;
      parsingState.index = targetState.index;
      parsingState.lexer = targetState.lexer;
      parsingState.errors = targetState.errors;
    };
  }

  private _parse(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    commitParser: () => void,
    stopOnError: boolean,
  ) {
    /**
     * Before re-lex, the caller should make sure the reLexStack is not empty!
     */
    const reLex = this.reLexFactory(parsingState, reLexStack, rollbackStack);

    while (true) {
      if (parsingState.index >= parsingState.buffer.length) {
        // end of buffer, try to lex input string to get next ASTNode
        const res = parsingState.stateStack
          .at(-1)!
          .tryLex(parsingState.lexer, this.debug, this.logger);
        // if no more ASTNode can be lexed
        if (res.length == 0) {
          // try to restore from re-lex stack
          if (this.reLex && reLexStack.length > 0) {
            if (this.debug)
              this.logger(`[Try Lex] All candidates failed. Try to re-lex.`);
            reLex();
          } else {
            // no more ASTNode can be lexed, parsing failed
            if (this.debug)
              this.logger(
                `[End] No matching token can be lexed. Rest of input: ${JSON.stringify(
                  parsingState.lexer.buffer.slice(
                    parsingState.lexer.digested,
                    parsingState.lexer.digested + 30,
                  ),
                )}${
                  parsingState.lexer.buffer.length -
                    parsingState.lexer.digested >
                  30
                    ? `...${
                        parsingState.lexer.buffer.length -
                        parsingState.lexer.digested -
                        30
                      } more chars`
                    : ""
                }\nCandidates:\n${parsingState.stateStack.at(-1)!.str}`,
              );
            return { output: rejectedParserOutput, lexer: parsingState.lexer };
          }
        } else {
          // lex success, record all possible lexing results for later use
          // we need to append reLexStack reversely, so that the first lexing result is at the top of the stack
          if (this.reLex) {
            for (let i = res.length - 1; i >= 0; --i) {
              reLexStack.push({
                stateStack: parsingState.stateStack.slice(), // make a copy
                buffer: parsingState.buffer.slice().concat(res[i].node),
                lexer: res[i].lexer,
                index: parsingState.index,
                errors: parsingState.errors.slice(),
                rollbackStackLength: rollbackStack.length,
              });
            }
            // use the first lexing result to continue parsing
            const state = reLexStack.pop()!;
            parsingState.buffer = state.buffer;
            parsingState.lexer = state.lexer;
          } else {
            // TODO: add tests when disable re-lex
            // use the first lexing result to continue parsing
            parsingState.buffer = parsingState.buffer.concat(res[0].node);
            parsingState.lexer = res[0].lexer;
          }
          if (this.debug)
            this.logger(
              `[Try Lex] Apply: ${
                parsingState.buffer.at(-1)!.strWithoutName.value
              }`,
            );
        }
      }

      // try to construct next state
      const nextStateResult = parsingState.stateStack
        .at(-1)!
        .getNext(this.grammars, parsingState.buffer[parsingState.index]);
      if (nextStateResult.state == null) {
        // try to restore from re-lex stack
        if (this.reLex && reLexStack.length > 0) {
          reLex();
          continue;
        } else {
          // no more candidate can be constructed, parsing failed
          if (this.debug)
            this.logger(
              `[End] No more candidate. Node=${parsingState.buffer.at(
                -1,
              )} Candidates:\n${parsingState.stateStack.at(-1)!.str}`,
            );
          // TODO: re-parse
          return { output: rejectedParserOutput, lexer: parsingState.lexer };
        }
      }

      // next state exist, push stack
      parsingState.stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const res = parsingState.stateStack
        .at(-1)!
        .tryReduce(
          parsingState.buffer,
          this.entryNTs,
          this.ignoreEntryFollow,
          this.followSets,
          parsingState.lexer,
          this.cascadeQueryPrefix,
          this.reParse,
          this.debug,
          this.logger,
        );

      // rejected
      if (!res.accept) {
        parsingState.index++;
        continue; // try to digest more
      }
      // else, accepted

      const possibility = res.possibilities[0];
      // TODO: handle other possibilities

      if (possibility.commit) {
        commitParser();
      } else {
        // update rollback stack
        if (this.rollback)
          rollbackStack.push({
            rollback: possibility.rollback,
            context: possibility.context,
          });
      }
      const reduced =
        parsingState.buffer.length - possibility.buffer.length + 1; // how many nodes are digested
      parsingState.index -= reduced - 1; // digest n, generate 1
      parsingState.buffer = possibility.buffer;
      parsingState.errors.push(...possibility.errors);
      for (let i = 0; i < reduced; ++i) parsingState.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (
        this.entryNTs.has(parsingState.buffer[0].kind as Kinds) &&
        parsingState.index == 0
      )
        return {
          output: {
            accept: true,
            buffer: parsingState.buffer,
            errors: parsingState.errors,
          },
          lexer: parsingState.lexer,
        };
      // if stop on error, return partial result
      if (stopOnError && parsingState.errors.length > 0)
        return {
          output: {
            accept: true,
            buffer: parsingState.buffer,
            errors: parsingState.errors,
          },
          lexer: parsingState.lexer,
        };

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
      ignoreEntryFollow: boolean;
      reParse: boolean;
    },
  ) {
    const NTs = new Set(data.NTs);
    const grammars = GrammarRepo.fromJSON(data.grammars);
    const grs = ReadonlyGrammarRuleRepo.fromJSON<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
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
      options.ignoreEntryFollow,
      options.reParse,
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
