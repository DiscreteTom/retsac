import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarSet, GrammarRule, GrammarType } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state. */
export class State<T> {
  /** Sorted candidates by candidates' string value. */
  readonly candidates: readonly Candidate<T>[];
  private nextCache: Map<string, State<T> | null>;

  /**
   * State should only be created when:
   *
   * 1. DFA create entry state.
   * 2. `State.getNext`.
   *
   * This will ensure that all states are unique and only one instance exists.
   */
  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates.sort((a, b) =>
      a.toString() > b.toString() ? 1 : -1
    );
    this.nextCache = new Map();
  }

  getNext(
    next: Readonly<ASTNode<T>>,
    NTClosures: ReadonlyMap<string, GrammarRule<T>[]>,
    allStates: Map<string, State<T>>,
    allInitialCandidates: ReadonlyMap<string, Candidate<T>>
  ): { state: State<T> | null; changed: boolean } {
    const key = JSON.stringify({ type: next.type, text: next.text });

    // try to get from local cache
    const cache = this.nextCache.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
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
      .map(
        (gr) =>
          // get initial candidate from global cache
          allInitialCandidates.get(Candidate.getString({ gr, digested: 0 }))!
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    const result =
      nextCandidates.length == 0 ? null : new State(nextCandidates);

    // check & update global state cache
    if (result != null) {
      const cache = allStates.get(result.toString());
      if (cache !== undefined) {
        this.nextCache.set(key, cache);
        return { state: cache, changed: false };
      } else {
        allStates.set(result.toString(), result);
      }
    }

    this.nextCache.set(key, result);
    return { state: result, changed: true };
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
      if (res.accept) return res;
    }

    return { accept: false };
  }

  contains(gr: Readonly<GrammarRule<T>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * Get the string representation of this state.
   *
   * Since candidates are sorted, the string representation of this state is unique.
   */
  toString() {
    return this.candidates.map((c) => c.toString()).join("\n");
  }
}
