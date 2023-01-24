import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarSet } from "../../base";
import { BaseState } from "../../base/DFA";
import { ParserOutput } from "../../model";
import { ParserContext } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state for expectational LR parser. */
export class State<T> extends BaseState<
  T,
  string,
  ParserContext<T>,
  Candidate<T>,
  State<T>
> {
  /**
   * State should only be created when:
   *
   * 1. DFA create entry state.
   * 2. `State.getNext`.
   *
   * This will ensure that all states are unique and only one instance exists.
   */
  constructor(candidates: Candidate<T>[]) {
    super(candidates, State);
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   * Return all the possible results.
   */
  tryLex(
    lexer: ILexer,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<T>; lexer: ILexer }[] {
    const res: { node: ASTNode<T>; lexer: ILexer }[] = [];
    this.candidates.map((c) => {
      const l = lexer.clone(); // each candidate should have its own lexer to avoid side effect
      res.push(...c.tryLex(l, followSets));
    });
    return res;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: ILexer,
    debug: boolean
  ): {
    res: ParserOutput<T>;
    rollback?: Callback<T, string, ParserContext<T>>;
    context?: ParserContext<T>;
  } {
    for (const c of this.candidates) {
      const { res, context } = c.tryReduce(
        buffer,
        entryNTs,
        followSets,
        lexer,
        debug
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first result
      if (res.accept) return { res, rollback: c.gr.rollback, context };
    }

    return { res: { accept: false } };
  }
}
