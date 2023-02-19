import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import {
  Callback,
  GrammarRule,
  GrammarSet,
  GrammarType,
  ParserContext,
} from "../model";
import { Candidate } from "./candidate";

/** State for ELR parsers. */
export class State<T> {
  readonly candidates: readonly Candidate<T>[];
  protected nextCache: Map<string, State<T> | null>;

  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates;
    this.nextCache = new Map();
  }

  getNext(
    next: Readonly<ASTNode<T>>,
    NTClosures: ReadonlyMap<string, GrammarRule<T>[]>,
    allStatesCache: Map<string, State<T>>,
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
      nextCandidates.length == 0 ? null : new State<T>(nextCandidates);

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

  contains(gr: Readonly<GrammarRule<T>>, digested: number) {
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
    rollback?: Callback<T>;
    context?: ParserContext<T>;
    commit?: boolean;
  } {
    for (const c of this.candidates) {
      const { res, context, commit } = c.tryReduce(
        buffer,
        entryNTs,
        followSets,
        lexer,
        debug
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first result
      if (res.accept) return { res, rollback: c.gr.rollback, context, commit };
    }

    return { res: { accept: false } };
  }
}