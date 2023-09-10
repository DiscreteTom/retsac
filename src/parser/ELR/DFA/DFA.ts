import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import { ParserOutput, rejectedParserOutput } from "../../model";
import {
  GrammarRepo,
  GrammarRule,
  GrammarRuleRepo,
  GrammarSet,
  ReLexStack,
  RollbackStack,
} from "../model";
import { CandidateRepo } from "./candidate";
import { ReadonlyFirstSets, ReadonlyFollowSets } from "./model";
import { State, StateRepo } from "./state";
import { map2serializable, serializable2map } from "./utils";

/**
 * DFA for ELR parsers. Stateless.
 */
export class DFA<ASTData, Kinds extends string, LexerKinds extends string> {
  constructor(
    readonly grammarRules: GrammarRuleRepo<ASTData, Kinds, LexerKinds>,
    private readonly entryNTs: ReadonlySet<string>,
    private readonly entryState: State<ASTData, Kinds, LexerKinds>,
    private readonly NTClosures: ReadonlyMap<
      string,
      GrammarRule<ASTData, Kinds, LexerKinds>[]
    >,
    public readonly firstSets: ReadonlyFirstSets,
    public readonly followSets: ReadonlyFollowSets,
    private readonly candidates: CandidateRepo<ASTData, Kinds, LexerKinds>,
    private readonly states: StateRepo<ASTData, Kinds, LexerKinds>,
    readonly grammars: GrammarRepo,
    readonly NTs: ReadonlySet<string>,
    private readonly cascadeQueryPrefix: string | undefined,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
    public debug: boolean,
    public logger: Logger
  ) {}

  getAllStates() {
    return this.states as Readonly<StateRepo<ASTData, Kinds, LexerKinds>>;
  }

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: readonly ASTNode<ASTData, Kinds | LexerKinds>[],
    lexer: ILexer<any, any>,
    reLexStack: ReLexStack<
      State<ASTData, Kinds, LexerKinds>,
      ASTData,
      Kinds,
      LexerKinds
    >,
    rollbackStack: RollbackStack<ASTData, Kinds, LexerKinds>,
    commitParser: () => void,
    stopOnError = false
  ): {
    output: ParserOutput<ASTData, Kinds | LexerKinds>;
    lexer: ILexer<any, any>;
  } {
    // reset state stack with entry state
    /**
     * Current state is `states.at(-1)`.
     */
    let stateStack = [this.entryState];

    let index = 0; // buffer index
    let errors: ASTNode<ASTData, Kinds | LexerKinds>[] = [];

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
          }" Trying: ${buffer.at(-1)}`
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
                  lexer.digested + 10
                )}\nCandidates:\n${stateStack.at(-1)!.str}`
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
              }`
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
          this.logger
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
      if (this.entryNTs.has(buffer[0].kind) && index == 0)
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
      candidates: this.candidates.toJSON(this.grammarRules),
      states: this.states.toJSON(this.candidates),
      entryState: this.states.getKey(this.entryState),
      NTClosures: map2serializable(this.NTClosures, (grs) =>
        grs.map((gr) => this.grammarRules.getKey(gr))
      ),
      firstSets: map2serializable(this.firstSets, (v) =>
        v.toJSON(this.grammars)
      ),
      followSets: map2serializable(this.followSets, (v) =>
        v.toJSON(this.grammars)
      ),
      cascadeQueryPrefix: this.cascadeQueryPrefix,
    };
  }

  static fromJSON<ASTData, Kinds extends string, LexerKinds extends string>(
    data: ReturnType<DFA<ASTData, Kinds, LexerKinds>["toJSON"]>,
    options: {
      logger: Logger;
      debug: boolean;
      rollback: boolean;
      reLex: boolean;
    }
  ) {
    const NTs = new Set(data.NTs);
    const grammars = GrammarRepo.fromJSON(data.grammars);
    const grs = GrammarRuleRepo.fromJSON<ASTData, Kinds, LexerKinds>(
      data.grammarRules,
      grammars
    );
    const candidates = CandidateRepo.fromJSON<ASTData, Kinds, LexerKinds>(
      data.candidates as any,
      grs
    );
    const states = StateRepo.fromJSON(data.states, candidates);
    const firstSets = serializable2map(data.followSets, (v) =>
      GrammarSet.fromJSON(v, grammars)
    ) as ReadonlyFirstSets;
    const followSets = serializable2map(data.followSets, (v) =>
      GrammarSet.fromJSON(v, grammars)
    ) as ReadonlyFollowSets;
    const NTClosures = serializable2map(data.NTClosures, (v) =>
      v.map((s) => grs.getByString(s)!)
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
      options.logger
    );
  }
}
