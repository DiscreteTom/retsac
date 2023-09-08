import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import { ParserOutput, rejectedParserOutput } from "../../model";
import {
  GrammarRepo,
  GrammarRule,
  GrammarRuleRepo,
  GrammarSet,
} from "../model";
import { ReLexStack, RollbackStack } from "../model";
import { CandidateRepo } from "./candidate";
import { State, StateRepo } from "./state";
import { map2serializable } from "./utils";

/**
 * DFA for ELR parsers. Stateless.
 */
export class DFA<ASTData, Kinds extends string> {
  constructor(
    private readonly grs: GrammarRuleRepo<ASTData, Kinds>,
    private readonly entryNTs: ReadonlySet<string>,
    private readonly entryState: State<ASTData, Kinds>,
    private readonly NTClosures: ReadonlyMap<
      string,
      GrammarRule<ASTData, Kinds>[]
    >,
    /**
     *  `NT => Grammars`
     */
    public readonly firstSets: ReadonlyMap<string, GrammarSet>,
    /**
     * `NT => Grammars`
     */
    public readonly followSets: ReadonlyMap<string, GrammarSet>,
    private readonly candidates: CandidateRepo<ASTData, Kinds>,
    private readonly states: StateRepo<ASTData, Kinds>,
    private readonly grammars: GrammarRepo,
    private readonly cascadeQueryPrefix: string | undefined,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
    public debug: boolean,
    public logger: Logger
  ) {}

  getAllStates() {
    return this.states as Readonly<StateRepo<ASTData, Kinds>>;
  }

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: readonly ASTNode<ASTData, Kinds>[],
    lexer: ILexer<any, any>,
    reLexStack: ReLexStack<State<ASTData, Kinds>, ASTData, Kinds>,
    rollbackStack: RollbackStack<ASTData, Kinds>,
    commitParser: () => void,
    stopOnError = false
  ): { output: ParserOutput<ASTData, Kinds>; lexer: ILexer<any, any> } {
    // reset state stack with entry state
    /**
     * Current state is `states.at(-1)`.
     */
    let stateStack = [this.entryState];

    let index = 0; // buffer index
    let errors: ASTNode<ASTData, Kinds>[] = [];

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
        .getNext(
          this.grammars,
          buffer[index],
          this.NTClosures,
          this.states,
          this.candidates
        );
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

  toSerializable() {
    return {
      entryNTs: [...this.entryNTs],
      grammars: this.grammars.toSerializable(),
      grs: this.grs.toSerializable(this.grammars),
      candidates: this.candidates.toSerializable(this.grs),
      states: this.states.toSerializable(this.candidates),
      entryState: this.states.getKey(this.entryState),
      NTClosures: map2serializable(this.NTClosures, (grs) =>
        grs.map((gr) => this.grs.getKey(gr))
      ),
      firstSets: map2serializable(this.firstSets, (v) =>
        v.toSerializable(this.grammars)
      ),
      followSets: map2serializable(this.followSets, (v) =>
        v.toSerializable(this.grammars)
      ),
      cascadeQueryPrefix: this.cascadeQueryPrefix,
    };
  }
}
