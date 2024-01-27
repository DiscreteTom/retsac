import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  IReadonlyLexer,
  IToken,
} from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { ASTNode, TNode } from "../../../ast";
import type {
  RejectedParserOutput,
  AcceptedParserOutput,
} from "../../../output";
import { rejectedParserOutput } from "../../../output";
import type {
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../../selector";
import { StateCacheMissError } from "../../error";
import type { GrammarStringNoName, TokenASTDataMapperExec } from "../../model";
import {
  type GrammarRepo,
  type GrammarRule,
  type GrammarRuleContext,
  type Callback,
  type Grammar,
  GrammarType,
} from "../../model";
import type {
  Candidate,
  CandidateID,
  CandidateRepo,
  ReadonlyCandidateRepo,
} from "../candidate";
import type { ReadonlyFollowSets, ReadonlyNTClosures } from "../model";
import { lexGrammar, map2serializable, prettierLexerRest } from "../utils";
import type { StateRepo } from "./state-repo";

/**
 * @see {@link State.id}.
 */
export type StateID = string & NonNullable<unknown>; // same as string, but won't be inferred as string literal (new type pattern)

/**
 * @see {@link State.toJSON}.
 */
export type SerializableState = {
  candidates: CandidateID[];
  nextMap: {
    [key: string]: StateID | null;
  };
};

/**
 * State for ELR parsers.
 */
export class State<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  readonly candidates: readonly Candidate<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[];
  /**
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   *
   * Since we have GrammarRepo to store all grammars,
   * we can use Grammar as the key of this map.
   */
  private readonly nextMap: Map<
    Grammar<NTs | ExtractKinds<LexerDataBindings>>,
    State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    > | null // don't use `undefined` here because `Map.get` return `undefined` when key not found
  >;

  /**
   * Format: `candidateId\n...`.
   */
  readonly id: StateID;

  /**
   * Only {@link StateRepo} should use this constructor.
   */
  constructor(
    candidates: Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >[],
    id: string,
  ) {
    this.candidates = candidates;
    this.id = id;
    this.nextMap = new Map();
  }

  generateNext(
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
    next: Grammar<NTs | ExtractKinds<LexerDataBindings>>,
    NTClosures: ReadonlyNTClosures<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    allStates: StateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    cs: CandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ): {
    state: State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    > | null;
    changed: boolean;
  } {
    const grammar =
      repo.match({
        // first, try to do an accurate match with text if text is provided.
        // if the text is not provided, this will still always return a result.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
        text: next.text,
      }) ??
      repo.match({
        // if the last match failed, means the text is provided but not matched.
        // try to match without text.
        kind: next.kind,
        name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
        text: undefined,
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
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
    next: Readonly<
      ASTNode<
        NTs | ExtractKinds<LexerDataBindings>,
        NTs,
        ASTData,
        ErrorType,
        IToken<LexerDataBindings, LexerErrorType>,
        Global
      >
    >,
  ): {
    state: State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    > | null;
    changed: boolean;
  } {
    const grammar = next.isT()
      ? repo.match({
          // first, try to do an accurate match with text if text is provided.
          kind: next.kind,
          name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
          text: next.text,
        }) ??
        repo.match({
          // if the last match failed, means the text is provided but not matched.
          // try to match without text.
          kind: next.kind,
          name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
          text: undefined,
        })! // this will always return a result
      : // else, next is an NT, match without text
        repo.match({
          kind: next.kind,
          name: next.kind, // use kind as name since the node's name should be defined by parent which is not known here
          text: undefined,
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
        NTs,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    digested: number,
  ) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * For debug output.
   *
   * Format: `State({ candidates })`.
   */
  toString() {
    return `State(${JSON.stringify({
      candidates: this.candidates.map((c) => c.toString()),
    })})`;
  }

  /**
   * @see {@link State.id}.
   */
  static generateId<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
    Global,
  >(
    data: Pick<
      State<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
      "candidates"
    >,
  ): StateID {
    return data.candidates
      .map((c) => c.id)
      .sort()
      .join("\n");
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   * Return all the possible results after deduplication.
   */
  tryLex(
    trimmedLexer: IReadonlyLexer<
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    tokenASTDataMapper: ReadonlyMap<
      ExtractKinds<LexerDataBindings>,
      TokenASTDataMapperExec<LexerDataBindings, LexerErrorType, ASTData>
    >,
    startCandidateIndex: number,
    lexedGrammars: Set<GrammarStringNoName>,
    global: Global,
    debug: boolean,
    logger: Logger,
  ):
    | {
        node: TNode<
          NTs | ExtractKinds<LexerDataBindings>,
          NTs,
          ASTData,
          ErrorType,
          IToken<LexerDataBindings, LexerErrorType>,
          Global
        >;
        trimmedLexer: ILexer<
          LexerDataBindings,
          LexerActionState,
          LexerErrorType
        >;
        nextCandidateIndex: number;
      }
    | undefined {
    for (let i = startCandidateIndex; i < this.candidates.length; i++) {
      const c = this.candidates[i];
      // if already all digested, or the current grammar is not a T, skip
      if (c.current === undefined || c.current.type !== GrammarType.T) continue;

      // if current grammar is already lexed, skip
      // we don't need to check name here since ASTNode's name is set later
      if (lexedGrammars.has(c.current.grammarStringNoName)) {
        if (debug) {
          const info = {
            candidate: c.toString(),
            rest: prettierLexerRest(trimmedLexer),
          };
          logger.log({
            entity: "Parser",
            message: `try lex: skip for candidate ${info.candidate} (cache hit)`,
            info,
          });
        }
        continue;
      }

      // lex candidate.current
      const r = lexGrammar<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >(
        c.current as Grammar<ExtractKinds<LexerDataBindings>>,
        trimmedLexer,
        tokenASTDataMapper,
        global,
      );
      // mark this grammar as done, no matter if the lex is successful
      lexedGrammars.add(c.current.grammarStringNoName);

      if (debug) {
        if (r !== undefined) {
          const info = {
            candidate: c.toString(),
            got: r.node.toString(),
          };
          logger.log({
            entity: "Parser",
            message: `try lex: got ${info.got} for candidate ${info.candidate} (cache miss)`,
            info: info,
          });
        } else {
          const info = {
            candidate: c.toString(),
            rest: prettierLexerRest(trimmedLexer),
          };
          logger.log({
            entity: "Parser",
            message: `try lex: failed for candidate ${info.candidate} (cache miss), rest: ${info.rest}`,
            info,
          });
        }
      }

      if (r === undefined) continue;

      // lex successfully, return
      return {
        ...r,
        nextCandidateIndex: i + 1,
      };
    }

    // all candidates checked, no accept, return undefined
    return undefined;
  }

  /**
   * Traverse all candidates to try to reduce.
   */
  tryReduce(
    buffer: readonly ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >[],
    entryNTs: ReadonlySet<string>,
    ignoreEntryFollow: boolean,
    followSets: ReadonlyFollowSets<NTs, ExtractKinds<LexerDataBindings>>,
    trimmedLexer: IReadonlyLexer<
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    selector: ASTNodeSelector<
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >,
    firstMatchSelector: ASTNodeFirstMatchSelector<
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >,
    global: Global,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<
        NTs,
        ASTData,
        ErrorType,
        IToken<LexerDataBindings, LexerErrorType>,
        Global
      > & {
        context: GrammarRuleContext<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >;
        commit: boolean;
        rollback?: Callback<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >;
      }) {
    if (debug) {
      const info = {
        state: this.id,
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
        trimmedLexer,
        selector,
        firstMatchSelector,
        global,
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

  toJSON(): SerializableState {
    return {
      candidates: this.candidates.map((c) => c.id),
      nextMap: map2serializable(
        this.nextMap,
        (g) => g.grammarString,
        (s) => (s === null ? null : s.id),
      ),
    };
  }

  static fromJSON<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
    Global,
  >(
    data: SerializableState,
    cs: ReadonlyCandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  ) {
    const candidates = data.candidates.map((c) => cs.get(c)!);
    const s = new State(candidates, State.generateId({ candidates }));

    // restore nextMap after the whole state repo is filled.
    const restoreNextMap = (
      ss: StateRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next === null) s.nextMap.set(repo.get(key)!, null);
        else s.nextMap.set(repo.get(key)!, ss.get(next)!);
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
    res.push(`state ${escapeStateDescription(this.id)} as ${hash(this.id)}`);

    // append transition
    this.nextMap.forEach((next, key) => {
      if (next !== null)
        res.push(
          `${hash(this.id)} --> ${hash(next.id)}: ${escapeTransition(
            key.grammarStringNoName,
          )}`,
        );
      // else, next === null, don't draw this transition since the graph will grow too large
    });
    return res.join("\n");
  }
}

export type ReadonlyState<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = Pick<
  State<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  | "candidates"
  | "contains"
  | "getNext"
  | "id"
  | "toJSON"
  | "toMermaid"
  | "toString"
  | "tryLex"
  | "tryReduce"
>;
