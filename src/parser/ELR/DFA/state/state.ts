import type { ILexer } from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { ASTNode } from "../../../ast";
import type {
  RejectedParserOutput,
  AcceptedParserOutput,
} from "../../../output";
import { rejectedParserOutput } from "../../../output";
import { StateCacheMissError } from "../../error";
import type {
  GrammarRepo,
  GrammarRule,
  GrammarRuleContext,
  Callback,
} from "../../model";
import type {
  Candidate,
  CandidateRepo,
  ReadonlyCandidateRepo,
} from "../candidate";
import type { ReadonlyFollowSets } from "../first-follow-sets";
import { map2serializable } from "../utils";
import type { StateRepo, ReadonlyStateRepo } from "./state-repo";

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
    // TODO: directly use grammar as key, since we have grammar repo
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
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    ss: ReadonlyStateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
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
    cs: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
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
