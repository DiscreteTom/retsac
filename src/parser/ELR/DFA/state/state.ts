import type { ILexer, ReadonlyILexer } from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { ASTNode } from "../../../ast";
import type {
  RejectedParserOutput,
  AcceptedParserOutput,
} from "../../../output";
import { rejectedParserOutput } from "../../../output";
import { StateCacheMissError } from "../../error";
import {
  type GrammarRepo,
  type GrammarRule,
  type GrammarRuleContext,
  type Callback,
  type Grammar,
  GrammarType,
} from "../../model";
import { notUndefinedFilter } from "../../utils";
import type {
  Candidate,
  CandidateRepo,
  ReadonlyCandidateRepo,
} from "../candidate";
import type { ReadonlyFollowSets } from "../first-follow-sets";
import { lexGrammar, map2serializable } from "../utils";
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
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   *
   * Since we have GrammarRepo to store all grammars,
   * we can use Grammar as the key of this map.
   */
  private readonly nextMap: Map<
    Grammar<Kinds | LexerKinds>,
    State<ASTData, ErrorType, Kinds, LexerKinds, LexerError> | null // don't use `undefined` here because `Map.get` return `undefined` when key not found
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
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
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

    // try to get from local cache
    const cache = this.nextMap.get(grammar);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, calculate and cache
    const res = allStates.addNext(this, grammar, NTClosures, cs);
    this.nextMap.set(grammar, res.state);
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

    // try to get from local cache
    const cache = this.nextMap.get(grammar);
    if (cache !== undefined) return { state: cache, changed: false };

    // not in cache, throw
    throw new StateCacheMissError(this, next);
  }

  contains(
    gr: Readonly<
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
    >,
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
   * Return all the possible results after deduplication.
   */
  tryLex(
    lexer: ReadonlyILexer<LexerError, LexerKinds>,
    debug: boolean,
    logger: Logger,
  ): {
    node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<LexerError, LexerKinds>;
  }[] {
    // for deduplication
    const done = new Map<
      string,
      ASTNode<ASTData, ErrorType, Kinds | LexerKinds> | null // don't use undefined, use null
    >();

    return this.candidates
      .map((c) => {
        // if already all digested, or the current grammar is not a T, skip
        if (c.current == undefined || c.current.type !== GrammarType.T) return;

        // if current grammar is already lexed, skip
        // we don't need to check name here since ASTNode's name is set later
        if (done.has(c.current.grammarStrWithoutName.value)) {
          if (debug) {
            const cache = done.get(c.current.grammarStrWithoutName.value);
            if (cache)
              logger(
                `[Try Lex] Got ${cache.strWithoutName.value} for candidate: ${c}`,
              );
            // uncomment next line for more details
            // else logger(`[Try Lex] Failed for candidate: ${c}`);
          }
          return;
        }

        // lex candidate.current
        const r = lexGrammar<ASTData, ErrorType, Kinds, LexerKinds, LexerError>(
          c.current,
          lexer,
        );
        // mark this grammar as done, no matter if the lex is successful
        done.set(c.current.grammarStrWithoutName.value, r?.node ?? null);

        if (debug) {
          if (r != undefined)
            logger(
              `[Try Lex] Got ${r.node.strWithoutName.value} for candidate: ${c}`,
            );
          // uncomment next line for more details
          // else logger(`[Try Lex] Failed for candidate: ${c}`);
        }
        return r;
      })
      .filter(notUndefinedFilter);
  }

  /**
   * Traverse all candidates to try to reduce.
   */
  tryReduce(
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    entryNTs: ReadonlySet<string>,
    ignoreEntryFollow: boolean,
    followSets: ReadonlyFollowSets<Kinds | LexerKinds>,
    lexer: ReadonlyILexer<LexerError, LexerKinds>,
    cascadeQueryPrefix: string | undefined,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<ASTData, ErrorType, Kinds | LexerKinds> & {
        context: GrammarRuleContext<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
          LexerError
        >;
        commit: boolean;
        rollback?: Callback<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
      }) {
    if (debug) logger(`[Try Reduce] State: \n${this.str}`);

    for (const c of this.candidates) {
      const res = c.tryReduce(
        buffer,
        entryNTs,
        ignoreEntryFollow,
        followSets,
        lexer,
        cascadeQueryPrefix,
        debug,
        logger,
      );

      if (res.accept) {
        // we've already resolved all reduce-reduce conflicts, we can return the first accepted result
        return {
          ...res,
          rollback: c.gr.rollback,
        };
      }
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
    repo: GrammarRepo<Kinds | LexerKinds>,
  ) {
    return {
      candidates: this.candidates.map((c) => cs.getKey(c)),
      nextMap: map2serializable(
        this.nextMap,
        (g) => repo.getKey(g),
        (s) => (s == null ? null : ss.getKey(s)),
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
    repo: GrammarRepo<Kinds | LexerKinds>,
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
        if (next == null) s.nextMap.set(repo.getByString(key)!, null);
        else s.nextMap.set(repo.getByString(key)!, ss.getByString(next)!);
      }
    };
    return { s, restoreNextMap };
  }

  toMermaid(
    hash: (s: string) => unknown,
    escapeStateDescription: (s: string) => string,
    escapeTransition: (s: string) => string,
  ) {
    const res = [] as string[];

    // append state
    res.push(`state ${escapeStateDescription(this.str)} as ${hash(this.str)}`);

    // append transition
    this.nextMap.forEach((next, key) => {
      if (next !== null)
        res.push(
          `${hash(this.str)} --> ${hash(next.str)}: ${escapeTransition(
            key.grammarStrWithoutName.value,
          )}`,
        );
      // else, next == null, don't draw this transition since the graph will grow too large
    });
    return res.join("\n");
  }
}
