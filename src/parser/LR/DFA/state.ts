import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarSet, GrammarRule } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state. */
export class State<T> {
  readonly candidates: Candidate<T>[];

  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    /** From where of the buffer to reduce. */
    start: number,
    entryNTs: Readonly<Set<string>>,
    followSets: Readonly<Map<string, GrammarSet>>,
    debug: boolean
  ): ParserOutput<T> {
    for (const c of this.candidates) {
      const res = c.tryReduce(buffer, start, entryNTs, followSets, debug);
      if (res.accept) return res;
    }

    return { accept: false };
  }

  contains(gr: Readonly<GrammarRule<T>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  eq(other: Readonly<State<T>>) {
    return (
      this.candidates.length == other.candidates.length &&
      this.candidates.every((c) => other.candidates.some((oc) => c.eq(oc)))
    );
  }
}
