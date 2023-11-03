import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  IReadonlyLexer,
  Token,
} from "../../../../lexer";
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
import type { ReadonlyFollowSets, ReadonlyNTClosures } from "../model";
import { lexGrammar, map2serializable, prettierLexerRest } from "../utils";
import type { StateRepo, ReadonlyStateRepo } from "./state-repo";

/**
 * State for ELR parsers.
 */
export class State<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  readonly candidates: readonly Candidate<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
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
    Grammar<Kinds | ExtractKinds<LexerDataBindings>>,
    State<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    > | null // don't use `undefined` here because `Map.get` return `undefined` when key not found
  >;

  constructor(
    candidates: Candidate<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[],
    str: string,
  ) {
    this.candidates = candidates;
    this.str = str;
    this.nextMap = new Map();
  }

  generateNext(
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
    next: Readonly<
      ASTNode<Kinds | ExtractKinds<LexerDataBindings>, never, never, never>
    >,
    NTClosures: ReadonlyNTClosures<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    allStates: StateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    cs: CandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ): {
    state: State<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    > | null;
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
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
    next: Readonly<
      ASTNode<Kinds, ASTData, ErrorType, Token<LexerDataBindings, LexerError>>
    >,
  ): {
    state: State<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    > | null;
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
      GrammarRule<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >
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
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: Pick<
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
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
    lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerError>,
    debug: boolean,
    logger: Logger,
  ): {
    node: ASTNode<
      Kinds,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerError>
    >;
    lexer: ILexer<LexerDataBindings, LexerActionState, LexerError>;
  }[] {
    // for deduplication
    const done = new Map<
      string,
      ASTNode<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerError>
      > | null // don't use undefined, use null
    >();

    return this.candidates
      .map((c) => {
        // if already all digested, or the current grammar is not a T, skip
        if (c.current === undefined || c.current.type !== GrammarType.T) return;

        // if current grammar is already lexed, skip
        // we don't need to check name here since ASTNode's name is set later
        if (done.has(c.current.grammarStrWithoutName.value)) {
          if (debug) {
            const cache = done.get(c.current.grammarStrWithoutName.value);
            if (cache) {
              const info = {
                candidate: c.toString(),
                got: cache.strWithoutName.value,
              };
              logger.log({
                entity: "Parser",
                message: `try lex: got ${info.got} for candidate ${info.candidate} (cache hit)`,
                info,
              });
            } else {
              const info = {
                candidate: c.toString(),
                rest: prettierLexerRest(lexer),
              };
              logger.log({
                entity: "Parser",
                message: `try lex: failed for candidate ${info.candidate} (cache hit), rest: ${info.rest}`,
                info,
              });
            }
          }
          return;
        }

        // lex candidate.current
        const r = lexGrammar<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >(c.current as Grammar<ExtractKinds<LexerDataBindings>>, lexer);
        // mark this grammar as done, no matter if the lex is successful
        done.set(c.current.grammarStrWithoutName.value, r?.node ?? null);

        if (debug) {
          if (r !== undefined) {
            const info = {
              candidate: c.toString(),
              got: r.node.strWithoutName.value,
            };
            logger.log({
              entity: "Parser",
              message: `try lex: got ${info.got} for candidate ${info.candidate} (cache miss)`,
              info: info,
            });
          } else {
            const info = {
              candidate: c.toString(),
              rest: prettierLexerRest(lexer),
            };
            logger.log({
              entity: "Parser",
              message: `try lex: failed for candidate ${info.candidate} (cache miss), rest: ${info.rest}`,
              info,
            });
          }
        }
        return r;
      })
      .filter(notUndefinedFilter);
  }

  /**
   * Traverse all candidates to try to reduce.
   */
  tryReduce(
    buffer: readonly ASTNode<
      Kinds,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerError>
    >[],
    entryNTs: ReadonlySet<string>,
    ignoreEntryFollow: boolean,
    followSets: ReadonlyFollowSets<Kinds, ExtractKinds<LexerDataBindings>>,
    lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerError>,
    cascadeQueryPrefix: string | undefined,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerError>
      > & {
        context: GrammarRuleContext<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >;
        commit: boolean;
        rollback?: Callback<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >;
      }) {
    if (debug) {
      const info = {
        state: this.str,
      };
      logger.log({
        entity: "Parser",
        message: `try reduce, state: \n${info.state}`,
        info,
      });
    }

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

  toSerializable(
    cs: ReadonlyCandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    ss: ReadonlyStateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    return {
      candidates: this.candidates.map((c) => cs.getKey(c)),
      nextMap: map2serializable(
        this.nextMap,
        (g) => repo.getKey(g),
        (s) => (s === null ? null : ss.getKey(s)),
      ),
      str: this.str,
    };
  }

  static fromJSON<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: ReturnType<
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >,
    cs: ReadonlyCandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const s = new State(
      data.candidates.map((c) => cs.getByString(c)!),
      data.str,
    );

    // restore nextMap after the whole state repo is filled.
    const restoreNextMap = (
      ss: StateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next === null) s.nextMap.set(repo.getByString(key)!, null);
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
      // else, next === null, don't draw this transition since the graph will grow too large
    });
    return res.join("\n");
  }
}
