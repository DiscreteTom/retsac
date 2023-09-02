import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet } from "../model";
import { ReLexStack, RollbackStack } from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";

/** DFA for ELR parsers. Stateless. */
export class DFA<T> {
  constructor(
    protected readonly allGrammarRules: readonly GrammarRule<T>[],
    protected readonly entryNTs: ReadonlySet<string>,
    private readonly entryState: State<T>,
    protected readonly NTClosures: ReadonlyMap<string, GrammarRule<T>[]>,
    /** `NT => Grammars` */
    private readonly firstSets: ReadonlyMap<string, GrammarSet>,
    /** `Grammar => Grammars` */
    protected readonly followSets: ReadonlyMap<string, GrammarSet>,
    /** `string representation of candidate => candidate` */
    protected readonly allInitialCandidates: ReadonlyMap<string, Candidate<T>>,
    /** `string representation of state => state` */
    protected readonly allStates: Map<string, State<T>>,
    private readonly cascadeQueryPrefix: string | undefined,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
    public debug: boolean,
    public logger: Logger
  ) {}

  private log(msg: string) {
    if (this.debug) this.logger(msg);
  }

  getFirstSets() {
    return this.firstSets;
  }
  getFollowSets() {
    return this.followSets;
  }

  getAllStates() {
    const result: State<T>[] = [];
    this.allStates.forEach((s) => result.push(s));
    return result;
  }

  /** Try to yield an entry NT. */
  parse(
    buffer: readonly ASTNode<T>[],
    lexer: ILexer<any>,
    reLexStack: ReLexStack<State<T>, T>,
    rollbackStack: RollbackStack<T>,
    commitParser: () => void,
    stopOnError = false
  ): { output: ParserOutput<T>; lexer: ILexer<any> } {
    // reset state stack with entry state
    /** Current state is `states.at(-1)`. */
    let stateStack = [this.entryState];

    let index = 0; // buffer index
    let errors: ASTNode<T>[] = [];

    /**
     * Before reLex, make sure the reLexStack is not empty!
     */
    const reLex = () => {
      const state = reLexStack.pop()!;
      const restoredInput =
        state.buffer.at(-1)!.text +
        state.lexer.getRest().slice(0, lexer.digested - state.lexer.digested);

      // rollback
      if (this.rollback) {
        while (rollbackStack.length > state.rollbackStackLength) {
          const { context, rollback } = rollbackStack.pop()!;
          rollback(context);
        }
      }

      // apply state
      stateStack = state.stateStack;
      buffer = state.buffer;
      lexer = state.lexer;
      index = state.index;
      errors = state.errors;

      this.log(
        `[Re-Lex] Restored input: "${restoredInput}" Trying: ${buffer
          .at(-1)!
          .toString()}`
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
            this.log(
              `[End] No matching token can be lexed. Rest of input: ${lexer
                .getRest()
                .slice(0, 10)}\nCandidates:\n${stateStack
                .at(-1)!
                .candidates.map((c) => c.toString())
                .join("\n")}`
            );
            return { output: { accept: false }, lexer };
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
          buffer[index],
          this.NTClosures,
          this.allStates,
          this.allInitialCandidates
        );
      if (nextStateResult.state == null) {
        // try to restore from re-lex stack
        if (this.reLex && reLexStack.length > 0) {
          reLex();
          continue;
        } else {
          // no more candidate can be constructed, parsing failed
          this.log(
            `[End] No more candidate. Node=${buffer
              .at(-1)
              ?.toString()} Candidates:\n${stateStack
              .at(-1)!
              .candidates.map((c) => c.toString())
              .join("\n")}`
          );
          return { output: { accept: false }, lexer };
        }
      }

      // next state exist, push stack
      stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const { res, rollback, context, commit } = stateStack
        .at(-1)!
        .tryReduce(
          buffer,
          this.entryNTs,
          this.followSets,
          lexer,
          this.cascadeQueryPrefix,
          this.log.bind(this)
        );
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      if (commit) {
        commitParser();
      } else {
        // update rollback stack
        if (this.rollback)
          rollbackStack.push({ rollback: rollback!, context: context! });
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
}
