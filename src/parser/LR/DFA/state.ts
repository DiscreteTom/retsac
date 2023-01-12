import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarSet, GrammarRule, GrammarType } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state. */
export class State<T> {
  readonly candidates: Candidate<T>[];

  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates;
  }

  getNext(
    next: Readonly<ASTNode<T>>,
    NTClosures: Readonly<Map<string, GrammarRule<T>[]>>
  ): State<T> | null {
    const directCandidates = this.candidates
      .map((c) => c.getNext(next))
      .filter((c) => c != null) as Candidate<T>[];
    const indirectCandidates = directCandidates
      .reduce((p, c) => {
        if (
          c.canDigestMore() &&
          c.current.type == GrammarType.NT &&
          !p.includes(c.current.content)
        )
          p.push(c.current.content);
        return p;
      }, [] as string[]) // de-duplicated NT list
      .reduce((p, c) => {
        NTClosures.get(c)!.map((gr) => {
          if (!p.includes(gr)) p.push(gr);
        });
        return p;
      }, [] as GrammarRule<T>[]) // de-duplicated GrammarRule list
      .map((gr) => new Candidate({ gr, digested: 0 })); // TODO: cache all candidates with digested = 0, to avoid creating new object every time
    const nextCandidates = directCandidates.concat(indirectCandidates);

    return nextCandidates.length == 0 ? null : new State(nextCandidates);
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
