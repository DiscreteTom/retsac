import { ASTNode } from "../../ast";
import { GrammarSet } from "../../base";
import { BaseState } from "../../base/DFA";
import { ParserOutput } from "../../model";
import { LRParserContext } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state. */
export class State<T> extends BaseState<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>,
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

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    /** From where of the buffer to reduce. */
    start: number,
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    debug: boolean
  ): ParserOutput<T> {
    for (const c of this.candidates) {
      const res = c.tryReduce(buffer, start, entryNTs, followSets, debug);
      // since we've already resolved all reduce-reduce conflicts, we can return the first result
      if (res.accept) return res;
    }

    return { accept: false };
  }
}
