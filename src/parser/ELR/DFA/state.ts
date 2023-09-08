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
  Grammar,
} from "../model";
import { Candidate, CandidateRepo } from "./candidate";
import { map2serializable } from "./utils";

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

  // TODO: split this into 2 functions? one for calculateAllStates, one for parse
  getNext(
    repo: GrammarRepo,
    next: Readonly<ASTNode<any, any>>,
    NTClosures: ReadonlyMap<string, GrammarRule<ASTData, Kinds>[]>,
    allStates: StateRepo<ASTData, Kinds>,
    cs: CandidateRepo<ASTData, Kinds>
  ): { state: State<ASTData, Kinds> | null; changed: boolean } {
    const grammar =
      repo.get({
        // first, try to do an accurate match with text if text is provided.
        // if the text is not provided, this will still always return a result.
        kind: next.kind,
        name: next.name,
        text: next.text,
      }) ??
      repo.get({
        // if the last match failed, means the text is provided but not matched.
        // try to match without text.
        kind: next.kind,
        name: next.name,
      })!; // this will always return a result
    const key = grammar.cacheKeyWithoutName.value;

    // try to get from local cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
    const res = allStates.addNext(this, next, grammar, NTClosures, cs);
    this.nextMap.set(key, res.state);
    return res;
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
      .map((c) => c.strWithGrammarName.value)
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
    debug: boolean,
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
        debug,
        logger
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first accepted result
      if (res.accept) return { ...res, rollback: c.gr.rollback };
    }

    return rejectedParserOutput;
  }

  toSerializable(
    cs: CandidateRepo<ASTData, Kinds>,
    ss: StateRepo<ASTData, Kinds>
  ) {
    return {
      candidates: this.candidates.map((c) => cs.getKey(c)),
      nextMap: map2serializable(this.nextMap, (s) =>
        s == null ? null : ss.getKey(s)
      ),
      str: this.str,
    };
  }
}

export class StateRepo<ASTData, Kinds extends string> {
  private ss: Map<string, State<ASTData, Kinds>>;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    return this.ss as ReadonlyMap<string, State<ASTData, Kinds>>;
  }

  getKey(s: Pick<State<any, any>, "candidates">) {
    return s instanceof State ? s.str : State.getString(s);
  }

  get(s: Pick<State<any, any>, "candidates">) {
    return this.ss.get(this.getKey(s));
  }

  /**
   * Return `undefined` if the state already exists.
   */
  addEntry(candidates: Candidate<ASTData, Kinds>[]) {
    const raw = { candidates };
    const key = this.getKey(raw);
    if (this.ss.has(key)) return undefined;

    const s = new State(candidates, key);
    this.ss.set(key, s);
    return s;
  }

  /**
   * If next state doesn't exist(no candidates), return `undefined`.
   * If next state exist and cached, return the cached state.
   * If next state exist and not cached, then create and cached and return the new state.
   */
  addNext(
    current: State<ASTData, Kinds>,
    next: Readonly<ASTNode<any, any>>,
    grammar: Grammar,
    NTClosures: ReadonlyMap<string, GrammarRule<ASTData, Kinds>[]>,
    cs: CandidateRepo<ASTData, Kinds>
  ) {
    const directCandidates = current.candidates
      .filter((c) => c.current == grammar) // match
      .map((c) => c.getNext(next, cs))
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
          cs.getInitial(gr)!
      );
    const nextCandidates = directCandidates.concat(indirectCandidates);

    // no next states
    if (nextCandidates.length == 0) return { state: null, changed: false };

    // check cache
    const raw = { candidates: nextCandidates };
    const key = this.getKey(raw);
    const cache = this.ss.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // create new
    const s = new State(nextCandidates, key);
    this.ss.set(key, s);
    return { state: s, changed: true };
  }

  some(f: (s: State<ASTData, Kinds>) => boolean) {
    for (const s of this.ss.values()) {
      if (f(s)) return true;
    }
    return false;
  }

  toSerializable(cs: CandidateRepo<ASTData, Kinds>) {
    return map2serializable(this.ss, (s) => s.toSerializable(cs, this));
  }
}
