import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import {
  AcceptedParserOutput,
  RejectedParserOutput,
  rejectedParserOutput,
} from "../../model";
import {
  GrammarRule,
  GrammarSet,
  GrammarType,
  GrammarRuleContext,
  Callback,
  GrammarRepo,
} from "../model";
import { Candidate } from "./candidate";

/**
 * State for ELR parsers.
 */
export class State<ASTData, Kinds extends string> {
  readonly candidates: readonly Candidate<ASTData, Kinds>[];
  readonly str: string;
  /**
   * `ASTNode.toString => state`.
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   */
  // don't use `undefined` here
  // because `Map.get` return `undefined` when key not found
  private readonly nextMap: Map<string, State<ASTData, Kinds> | null>;

  constructor(candidates: Candidate<ASTData, Kinds>[], str: string) {
    this.candidates = candidates;
    this.str = str;
    this.nextMap = new Map();
  }

  getNext(
    repo: GrammarRepo,
    next: Readonly<ASTNode<any, any>>,
    NTClosures: ReadonlyMap<string, GrammarRule<ASTData, Kinds>[]>,
    allStates: Map<string, State<ASTData, Kinds>>,
    allInitialCandidates: ReadonlyMap<string, Candidate<ASTData, Kinds>>
  ): { state: State<ASTData, Kinds> | null; changed: boolean } {
    const key =
      // for T/NT, we only need the kind & name to find the corresponding grammar
      (repo.get({ kind: next.kind, name: next.name }) ??
        // if not found, might be a literal, plus the text to find the corresponding grammar
        repo.get({
          kind: next.kind,
          name: next.name,
          text: next.text,
        }))!.calculateCacheKey(next);

    // try to get from local cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
    const directCandidates = this.candidates
      .map((c) => c.getNext(next))
      .filter((c) => c != null) as Candidate<ASTData, Kinds>[];
    const indirectCandidates = directCandidates
      .reduce((p, c) => {
        if (
          c.canDigestMore() &&
          c.current!.type == GrammarType.NT &&
          !p.includes(c.current!.kind)
        )
          p.push(c.current!.kind);
        return p;
      }, [] as string[]) // de-duplicated NT list
      .reduce((p, c) => {
        NTClosures.get(c)!.forEach((gr) => {
          if (!p.includes(gr)) p.push(gr);
        });
        return p;
      }, [] as GrammarRule<ASTData, Kinds>[]) // de-duplicated GrammarRule list
      .map(
        (gr) =>
          // get initial candidate from global cache
          // TODO: use CandidateRepo?
          allInitialCandidates.get(
            Candidate.getStringWithGrammarName({ gr, digested: 0 })
          )!
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    // check & update global state cache
    if (nextCandidates.length != 0) {
      const cacheKey = State.getString({ candidates: nextCandidates });
      const cache = allStates.get(cacheKey); // TODO: use StateRepo?
      if (cache !== undefined) {
        this.nextMap.set(key, cache);
        return { state: cache, changed: false };
      } else {
        const result = new State<ASTData, Kinds>(nextCandidates, cacheKey);
        allStates.set(cacheKey, result);
        this.nextMap.set(key, result);
        return { state: result, changed: true };
      }
    }
    // else, no next candidates
    this.nextMap.set(key, null);
    return { state: null, changed: false };
  }

  contains(gr: Readonly<GrammarRule<ASTData, Kinds>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * Get the string representation of this state.
   * Grammar's name will be included.
   * The result is sorted by candidate string, so that the same state will have the same string representation.
   * This is cached.
   */
  toString() {
    return this.str;
  }
  /**
   * Get the string representation of this state.
   * Grammar's name will be included.
   * The result is sorted by candidate string, so that the same state will have the same string representation.
   */
  static getString(data: Pick<State<any, any>, "candidates">) {
    return data.candidates
      .map((c) => c.toStringWithGrammarName())
      .sort()
      .join("\n");
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   * Return all the possible results.
   */
  tryLex(
    lexer: Readonly<ILexer<any, any>>,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<ASTData, Kinds>; lexer: ILexer<any, any> }[] {
    const res: { node: ASTNode<ASTData, Kinds>; lexer: ILexer<any, any> }[] =
      [];
    this.candidates.forEach((c) => {
      res.push(...c.tryLex(lexer, followSets));
    });
    return res;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<ASTData, Kinds>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: Readonly<ILexer<any, any>>,
    cascadeQueryPrefix: string | undefined,
    logger: Logger
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<ASTData, Kinds> & {
        context: GrammarRuleContext<ASTData, Kinds>;
        commit: boolean;
        rollback?: Callback<ASTData, Kinds>;
      }) {
    for (const c of this.candidates) {
      const res = c.tryReduce(
        buffer,
        entryNTs,
        followSets,
        lexer,
        cascadeQueryPrefix,
        logger
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first accepted result
      if (res.accept) return { ...res, rollback: c.gr.rollback };
    }

    return rejectedParserOutput;
  }
}
