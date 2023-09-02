import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import {
  Callback,
  GrammarRule,
  GrammarSet,
  GrammarType,
  GrammarRuleContext,
} from "../model";
import { Candidate } from "./candidate";

/** State for ELR parsers. */
export class State<T> {
  readonly candidates: readonly Candidate<T>[];
  /**
   * `ast node str => state`.
   * This will be calculated during `DFA.calculateAllStates`.
   */
  protected nextMap: Map<string, State<T> | null>;

  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates;
    this.nextMap = new Map();
  }

  getNext(
    next: Readonly<ASTNode<any>>,
    NTClosures: ReadonlyMap<string, GrammarRule<T>[]>,
    allStates: Map<string, State<T>>,
    allInitialCandidates: ReadonlyMap<string, Candidate<T>>
  ): { state: State<T> | null; changed: boolean } {
    const key = next.toUniqueString();

    // try to get from local cache
    const cache = this.nextMap.get(key);
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
          !p.includes(c.current.kind)
        )
          p.push(c.current.kind);
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
      const cacheKey = result.toString();
      const cache = allStates.get(cacheKey);
      if (cache !== undefined) {
        this.nextMap.set(key, cache);
        return { state: cache, changed: false };
      } else {
        allStates.set(cacheKey, result);
      }
    }

    this.nextMap.set(key, result);
    return { state: result, changed: true };
  }

  contains(gr: Readonly<GrammarRule<T>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * Get the string representation of this state.
   * The result is sorted by candidate string, so that the same state will have the same string representation.
   */
  toString() {
    const sorted = this.candidates.map((c) => c.toString()).sort();
    return sorted.join("\n");
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   * Return all the possible results.
   */
  tryLex(
    lexer: ILexer<any>,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<T>; lexer: ILexer<any> }[] {
    const res: { node: ASTNode<T>; lexer: ILexer<any> }[] = [];
    this.candidates.forEach((c) => {
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
    lexer: ILexer<any>,
    cascadeQueryPrefix: string | undefined,
    logger: Logger
  ): {
    res: ParserOutput<T>;
    rollback?: Callback<T>;
    context?: GrammarRuleContext<T>;
    commit?: boolean;
  } {
    for (const c of this.candidates) {
      const { res, context, commit } = c.tryReduce(
        buffer,
        entryNTs,
        followSets,
        lexer,
        cascadeQueryPrefix,
        logger
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first result
      if (res.accept) return { res, rollback: c.gr.rollback, context, commit };
    }

    return { res: { accept: false } };
  }
}
