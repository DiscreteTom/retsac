import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { GrammarSet } from "../../base";
import { BaseDFA } from "../../base/DFA";
import { ParserOutput } from "../../model";
import { ELRCallback, ELRParserContext } from "../model";
import { ELRGrammarRule } from "../model/grammar";
import { ReLexStack, RollbackStack } from "../model/re-lex";
import { Candidate } from "./candidate";
import { State } from "./state";

/** LR(1) DFA for expectational LR. Stateless. */
export class DFA<T> extends BaseDFA<
  T,
  string,
  ELRParserContext<T>,
  Candidate<T>,
  State<T>
> {
  constructor(
    allGrammarRules: readonly ELRGrammarRule<T>[],
    entryNTs: ReadonlySet<string>,
    entryState: State<T>,
    NTClosures: ReadonlyMap<string, ELRGrammarRule<T>[]>,
    /** `NT => Grammars` */
    firstSets: ReadonlyMap<string, GrammarSet>,
    /** `NT => Grammars` */
    followSets: ReadonlyMap<string, GrammarSet>,
    /** string representation of candidate => candidate */
    allInitialCandidates: ReadonlyMap<string, Candidate<T>>,
    /** string representation of state => state */
    allStatesCache: Map<string, State<T>>
  ) {
    super(
      allGrammarRules,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStatesCache
    );
  }

  /** Reset DFA then try to yield an entry NT. */
  parse(
    buffer: ASTNode<T>[],
    lexer: ILexer,
    reLexStack: ReLexStack<T>,
    rollbackStack: RollbackStack<T>,
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
      const { res, rollback, context } = this.stateStack
        .at(-1)!
        .tryReduce(buffer, this.entryNTs, this.followSets, lexer, this.debug);
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      rollbackStack.push({ rollback: rollback!, context: context! });
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
