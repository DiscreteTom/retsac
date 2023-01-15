import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { GrammarRule, GrammarSet } from "../../base";
import { BaseDFA } from "../../base/DFA/DFA";
import { ParserOutput } from "../../model";
import { ParserContext } from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";

/** LR(1) DFA. Stateless. */
export class DFA<T> extends BaseDFA<
  T,
  string,
  ParserContext<T>,
  Candidate<T>,
  State<T>
> {
  constructor(
    allGrammarRules: readonly GrammarRule<T, string, ParserContext<T>>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>
  ) {
    super(allGrammarRules, entryNTs, NTs, Candidate, State);
  }

  /** Reset DFA then try to yield an entry NT. */
  parse(
    buffer: ASTNode<T>[],
    lexer: ILexer,
    stopOnError = false
  ): ParserOutput<T> {
    this.reset();

    let index = 0; // buffer index
    const errors: ASTNode<T>[] = [];

    while (true) {
      if (index >= buffer.length) {
        // end of buffer, try to lex input string to get next ASTNode
        const res = this.stateStack.at(-1)!.tryLex(lexer, this.followSets);
        // no more ASTNode can be lexed, end of parsing
        if (res == null) return { accept: false };
        // push new ASTNode to buffer
        buffer.push(res);
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
        if (this.debug)
          console.log(
            `[End] No more candidate. Node=${buffer
              .at(-1)
              ?.toString()} Candidates:\n${this.stateStack
              .at(-1)!
              .candidates.map((c) => c.toString())
              .join("\n")}`
          );
        return { accept: false };
      }

      // push stack
      this.stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const res = this.stateStack
        .at(-1)!
        .tryReduce(buffer, this.entryNTs, this.followSets, lexer, this.debug);
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      const reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.push(...res.errors);
      for (let i = 0; i < reduced; ++i) this.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (this.entryNTs.has(buffer[0].type) && index == 0)
        return { accept: true, buffer, errors };
      // if stop on error, return partial result
      if (stopOnError && errors.length > 0)
        return { accept: true, buffer, errors };

      // continue loop, try to digest more with the newly reduced buffer
    }
  }

  /**
   * Calculate state machine's state transition map ahead of time and cache.
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  calculateAllStates(lexer?: ILexer) {
    // collect all grammars in rules
    const gs = new GrammarSet();
    this.allGrammarRules.forEach((gr) => {
      gr.rule.forEach((g) => {
        gs.add(g);
      });
    });
    // convert to mock AST node
    const mockNodes = gs.map((g) => g.toASTNode<T>(lexer));

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
}
