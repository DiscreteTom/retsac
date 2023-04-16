import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet } from "../model";
import { ReLexStack, RollbackStack } from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";

/** DFA for ELR parsers. Stateless. */
export class DFA<T> {
  /** Current state is `states.at(-1)`. */
  protected stateStack: State<T>[];
  debug: boolean;

  constructor(
    protected readonly allGrammarRules: readonly GrammarRule<T>[],
    protected readonly entryNTs: ReadonlySet<string>,
    private readonly entryState: State<T>,
    protected readonly NTClosures: ReadonlyMap<string, GrammarRule<T>[]>,
    /** `NT => Grammars` */
    private readonly firstSets: ReadonlyMap<string, GrammarSet>,
    /** `Grammar => Grammars` */
    protected readonly followSets: ReadonlyMap<string, GrammarSet>,
    /** string representation of candidate => candidate */
    protected readonly allInitialCandidates: ReadonlyMap<string, Candidate<T>>,
    /** string representation of state => state */
    protected readonly allStatesCache: Map<string, State<T>>,
    private readonly cascadeQueryPrefix: string | undefined
  ) {
    this.reset();
  }

  reset() {
    // reset state stack with entry state
    this.stateStack = [this.entryState];
  }

  getFirstSets() {
    return this.firstSets;
  }
  getFollowSets() {
    return this.followSets;
  }

  /**
   * Calculate state machine's state transition map ahead of time and cache.
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  calculateAllStates(lexer: ILexer) {
    // TODO: buildDFA will call this function, so we can move this into DFA.constructor or DFABuilder
    // collect all grammars in rules
    const gs = new GrammarSet();
    this.allGrammarRules.forEach((gr) => {
      gr.rule.forEach((g) => {
        gs.add(g);
      });
    });
    // convert to mock AST node
    const mockNodes = gs.map((g) => g.toTempASTNode(lexer));

    while (true) {
      let changed = false;
      this.allStatesCache.forEach((state) => {
        mockNodes.forEach((node) => {
          if (
            state.getNext(
              node,
              this.NTClosures,
              this.allStatesCache,
              this.allInitialCandidates
            ).changed
          )
            changed = true;
        });
      });
      if (!changed) break;
    }
    return this;
  }

  /**
   * Return all cached states. You might want to call `calculateAllState` first.
   */
  getAllStates() {
    const result: State<T>[] = [];
    this.allStatesCache.forEach((s) => result.push(s));
    return result;
  }

  /** Reset DFA then try to yield an entry NT. */
  parse(
    buffer: readonly ASTNode<T>[],
    lexer: ILexer,
    reLexStack: ReLexStack<State<T>, T>,
    rollbackStack: RollbackStack<T>,
    commitParser: () => void,
    stopOnError = false
  ): { output: ParserOutput<T>; lexer: ILexer } {
    this.reset();

    let index = 0; // buffer index
    let errors: ASTNode<T>[] = [];

    const reLex = () => {
      const state = reLexStack.pop();
      const restoredInput =
        state!.buffer.at(-1)!.text +
        state!.lexer.getRest().slice(0, lexer.digested - state!.lexer.digested);

      // rollback
      while (rollbackStack.length > state!.rollbackStackLength) {
        const { context, rollback } = rollbackStack.pop()!;
        rollback(context);
      }

      // apply state
      this.stateStack = state!.stateStack;
      buffer = state!.buffer;
      lexer = state!.lexer;
      index = state!.index;
      errors = state!.errors;

      if (this.debug)
        console.log(
          `[Re-Lex] Restored input: "${restoredInput}" Trying: ${buffer
            .at(-1)!
            .toString()}`
        );
    };

    while (true) {
      if (index >= buffer.length) {
        // end of buffer, try to lex input string to get next ASTNode
        const res = this.stateStack.at(-1)!.tryLex(lexer, this.followSets);
        // if no more ASTNode can be lexed
        if (res.length == 0) {
          // try to restore from re-lex stack
          if (reLexStack.length > 0) {
            reLex();
          } else {
            // no more ASTNode can be lexed, parsing failed
            if (this.debug)
              console.log(
                `[End] No matching token can be lexed. Rest of input: ${lexer
                  .getRest()
                  .slice(0, 10)}\nCandidates:\n${this.stateStack
                  .at(-1)!
                  .candidates.map((c) => c.toString())
                  .join("\n")}`
              );
            return { output: { accept: false }, lexer };
          }
        } else {
          // lex success, record all possible lexing results for later use
          // we need to append reLexStack reversely, so that the first lexing result is at the top of the stack
          for (let i = res.length - 1; i >= 0; --i) {
            reLexStack.push({
              stateStack: this.stateStack.slice(),
              buffer: buffer.slice().concat(res[i].node),
              lexer: res[i].lexer,
              index,
              errors: errors.slice(),
              rollbackStackLength: rollbackStack.length,
            });
          }
          // use the first lexing result to continue parsing
          const state = reLexStack.pop();
          buffer = state!.buffer;
          lexer = state!.lexer;
        }
      }

      // try to construct next state
      const nextStateResult = this.stateStack
        .at(-1)!
        .getNext(
          buffer[index],
          this.NTClosures,
          this.allStatesCache,
          this.allInitialCandidates
        );
      if (nextStateResult.state == null) {
        // try to restore from re-lex stack
        if (reLexStack.length > 0) {
          reLex();
          continue;
        } else {
          // no more candidate can be constructed, parsing failed
          if (this.debug)
            console.log(
              `[End] No more candidate. Node=${buffer
                .at(-1)
                ?.toString()} Candidates:\n${this.stateStack
                .at(-1)!
                .candidates.map((c) => c.toString())
                .join("\n")}`
            );
          return { output: { accept: false }, lexer };
        }
      }

      // next state exist, push stack
      this.stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const { res, rollback, context, commit } = this.stateStack
        .at(-1)!
        .tryReduce(
          buffer,
          this.entryNTs,
          this.followSets,
          lexer,
          this.cascadeQueryPrefix,
          this.debug
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
        rollbackStack.push({ rollback: rollback!, context: context! });
      }
      const reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.push(...res.errors);
      for (let i = 0; i < reduced; ++i) this.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (this.entryNTs.has(buffer[0].type) && index == 0)
        return { output: { accept: true, buffer, errors }, lexer };
      // if stop on error, return partial result
      if (stopOnError && errors.length > 0)
        return { output: { accept: true, buffer, errors }, lexer };

      // continue loop, try to digest more with the newly reduced buffer
    }
  }
}
