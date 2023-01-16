import { ASTNode } from "../../ast";
import {
  BaseParserContext,
  GrammarRule,
  GrammarType,
  StateClassCtor,
} from "../model";
import { BaseCandidate } from "./candidate";

/** Base state for LR and ELR parsers. */
export class BaseState<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  Child extends BaseState<T, After, Ctx, Candidate, Child>
> {
  readonly candidates: readonly Candidate[];
  protected nextCache: Map<string, Child | null>;

  constructor(
    candidates: Candidate[],
    private readonly ChildClass: StateClassCtor<T, After, Ctx, Candidate, Child>
  ) {
    this.candidates = candidates;
    this.nextCache = new Map();
  }

  getNext(
    next: Readonly<ASTNode<T>>,
    NTClosures: ReadonlyMap<string, GrammarRule<T, After, Ctx>[]>,
    allStatesCache: Map<string, Child>,
    allInitialCandidates: ReadonlyMap<string, Candidate>
  ): { state: Child | null; changed: boolean } {
    const key = JSON.stringify({ type: next.type, text: next.text });

    // try to get from local cache
    const cache = this.nextCache.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
    const directCandidates = this.candidates
      .map((c) => c.getNext(next))
      .filter((c) => c != null) as Candidate[];
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
      }, [] as GrammarRule<T, After, Ctx>[]) // de-duplicated GrammarRule list
      .map(
        (gr) =>
          // get initial candidate from global cache
          allInitialCandidates.get(
            BaseCandidate.getString({ gr, digested: 0 })
          )!
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    const result =
      nextCandidates.length == 0 ? null : new this.ChildClass(nextCandidates);

    // check & update global state cache
    if (result != null) {
      const cacheKey = result.toString(true);
      const cache = allStatesCache.get(cacheKey);
      if (cache !== undefined) {
        this.nextCache.set(key, cache);
        return { state: cache, changed: false };
      } else {
        allStatesCache.set(cacheKey, result);
      }
    }

    this.nextCache.set(key, result);
    return { state: result, changed: true };
  }

  contains(gr: Readonly<GrammarRule<T, After, Ctx>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * Get the string representation of this state.
   *
   * When `sort` is `true`, the string representation of this state is unique.
   */
  toString(sort = false) {
    if (sort) {
      const sorted = this.candidates.map((c) => c.toString()).sort();
      return sorted.join("\n");
    }
    return this.candidates.map((c) => c.toString()).join("\n");
  }
}
