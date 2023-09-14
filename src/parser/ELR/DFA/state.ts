import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ASTNode } from "../../ast";
import type { AcceptedParserOutput, RejectedParserOutput } from "../../output";
import { rejectedParserOutput } from "../../output";
import { StateCacheMissError } from "../error";
import type {
  GrammarRule,
  GrammarRuleContext,
  Callback,
  GrammarRepo,
  Grammar,
} from "../model";
import { GrammarType } from "../model";
import { nonNullFilter } from "../utils";
import type { Candidate, CandidateRepo } from "./candidate";
import type { ReadonlyFollowSets } from "./model";
import { map2serializable } from "./utils";

/**
 * State for ELR parsers.
 */
export class State<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  readonly candidates: readonly Candidate<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];
  readonly str: string;
  /**
   * `ASTNode.toString => state`.
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   */
  // don't use `undefined` here
  // because `Map.get` return `undefined` when key not found
  private readonly nextMap: Map<
    string,
    State<ASTData, ErrorType, Kinds, LexerKinds, LexerError> | null
  >;

  constructor(
    candidates: Candidate<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    str: string,
  ) {
    this.candidates = candidates;
    this.str = str;
    this.nextMap = new Map();
  }

  generateNext(
    repo: GrammarRepo<Kinds | LexerKinds>,
    next: Readonly<ASTNode<never, never, Kinds | LexerKinds>>,
    NTClosures: ReadonlyMap<
      string,
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
    >,
    allStates: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ): {
    state: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError> | null;
    changed: boolean;
  } {
    const grammar =
      repo.get({
        // first, try to do an accurate match with text if text is provided.
        // if the text is not provided, this will still always return a result.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
        text: next.text,
      }) ??
      repo.get({
        // if the last match failed, means the text is provided but not matched.
        // try to match without text.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
      })!; // this will always return a result
    const key = grammar.cacheKeyWithoutName.value;

    // try to get from local cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
    const res = allStates.addNext(this, grammar, NTClosures, cs);
    this.nextMap.set(key, res.state);
    return res;
  }

  getNext(
    repo: GrammarRepo<Kinds | LexerKinds>,
    next: Readonly<ASTNode<ASTData, ErrorType, Kinds | LexerKinds>>,
  ): {
    state: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError> | null;
    changed: boolean;
  } {
    const grammar =
      repo.get({
        // first, try to do an accurate match with text if text is provided.
        // if the text is not provided, this will still always return a result.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
        text: next.text,
      }) ??
      repo.get({
        // if the last match failed, means the text is provided but not matched.
        // try to match without text.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
      })!; // this will always return a result
    const key = grammar.cacheKeyWithoutName.value;

    // try to get from local cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, throw
    throw new StateCacheMissError(this, next);
  }

  contains(
    gr: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>,
    digested: number,
  ) {
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
  static getString<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: Pick<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
      "candidates"
    >,
  ) {
    return data.candidates
      .map((c) => c.strWithGrammarName)
      .sort()
      .join("\n");
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   * Return all the possible results.
   */
  tryLex(
    lexer: Readonly<ILexer<LexerError, LexerKinds>>,
    followSets: ReadonlyFollowSets<Kinds | LexerKinds>,
  ): {
    node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<LexerError, LexerKinds>;
  }[] {
    const res: {
      node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
      lexer: ILexer<LexerError, LexerKinds>;
    }[] = [];
    this.candidates.forEach((c) => {
      res.push(...c.tryLex(lexer, followSets));
    });
    return res;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyFollowSets<Kinds | LexerKinds>,
    lexer: Readonly<ILexer<unknown, LexerKinds>>,
    cascadeQueryPrefix: string | undefined,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<ASTData, ErrorType, Kinds | LexerKinds> & {
        context: GrammarRuleContext<ASTData, ErrorType, Kinds, LexerKinds>;
        commit: boolean;
        rollback?: Callback<ASTData, ErrorType, Kinds, LexerKinds>;
      }) {
    for (const c of this.candidates) {
      const res = c.tryReduce(
        buffer,
        entryNTs,
        followSets,
        lexer,
        cascadeQueryPrefix,
        debug,
        logger,
      );
      // since we've already resolved all reduce-reduce conflicts, we can return the first accepted result
      if (res.accept) return { ...res, rollback: c.gr.rollback };
    }

    return rejectedParserOutput;
  }

  toJSON(
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    ss: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ) {
    return {
      candidates: this.candidates.map((c) => cs.getKey(c)),
      nextMap: map2serializable(this.nextMap, (s) =>
        s == null ? null : ss.getKey(s),
      ),
      str: this.str,
    };
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: ReturnType<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>["toJSON"]
    >,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ) {
    const s = new State(
      data.candidates.map((c) => cs.getByString(c)!),
      data.str,
    );

    // restore nextMap after the whole state repo is filled.
    const restoreNextMap = (
      ss: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next == null) s.nextMap.set(key, null);
        else s.nextMap.set(key, ss.getByString(next)!);
      }
    };
    return { s, restoreNextMap };
  }
}

export class StateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  private ss: Map<
    string,
    State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >;

  constructor() {
    this.ss = new Map();
  }

  get states() {
    return this.ss as ReadonlyMap<
      string,
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
    >;
  }

  getKey(
    s: Pick<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
      "candidates"
    >,
  ): string {
    return s instanceof State ? s.str : State.getString(s);
  }

  get(
    s: Pick<
      State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
      "candidates"
    >,
  ) {
    return this.ss.get(this.getKey(s));
  }

  getByString(str: string) {
    return this.ss.get(str);
  }

  /**
   * Return `undefined` if the state already exists.
   */
  addEntry(
    candidates: Candidate<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
  ) {
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
    current: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    grammar: Grammar<Kinds | LexerKinds>,
    NTClosures: ReadonlyMap<
      string,
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
    >,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ) {
    const directCandidates = current.candidates
      .filter((c) => c.current?.equalWithoutName(grammar)) // current grammar match the next node, name should be ignored since the next node's name is defined by its parent
      .map((c) => c.generateNext(cs))
      .filter(nonNullFilter);
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
      .reduce(
        (p, c) => {
          NTClosures.get(c)!.forEach((gr) => {
            if (!p.includes(gr)) p.push(gr);
          });
          return p;
        },
        [] as GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[],
      ) // de-duplicated GrammarRule list
      .map(
        (gr) =>
          // get initial candidate from global cache
          cs.getInitial(gr)!,
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

  some(
    f: (s: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>) => boolean,
  ) {
    for (const s of this.ss.values()) {
      if (f(s)) return true;
    }
    return false;
  }

  toJSON(cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>) {
    return map2serializable(this.ss, (s) => s.toJSON(cs, this));
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: ReturnType<
      StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>["toJSON"]
    >,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ) {
    const ss = new StateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >();
    const callbacks = [] as ((
      ss: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    ) => void)[];
    for (const key in data) {
      const { s, restoreNextMap } = State.fromJSON(data[key], cs);
      ss.ss.set(key, s);
      callbacks.push(restoreNextMap);
    }
    // restore nextMap after the whole state repo is filled.
    callbacks.forEach((c) => c(ss));
    return ss;
  }
}
