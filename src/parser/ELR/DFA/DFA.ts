import { Stack } from "../../../helper/stack";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  IToken,
} from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ASTNode } from "../../ast";
import type { ParserOutput } from "../../output";
import { rejectedParserOutput } from "../../output";
import type {
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../selector";
import { GrammarRepo, ReadonlyGrammarRuleRepo, GrammarSet } from "../model";
import type {
  GrammarRuleID,
  GrammarString,
  ParsingState,
  ReLexState,
  RollbackState,
  SerializableGrammar,
  SerializableGrammarRule,
  TokenASTDataMapperExec,
} from "../model";
import { hashStringToNum } from "../utils";
import type { ReadonlyCandidateRepo, SerializableCandidate } from "./candidate";
import { CandidateRepo } from "./candidate";
import type {
  ReadonlyFirstSets,
  ReadonlyFollowSets,
  ReadonlyNTClosures,
} from "./model";
import type {
  ReadonlyStateRepo,
  SerializableState,
  State,
  StateID,
} from "./state";
import { StateRepo } from "./state";
import {
  stringMap2serializable,
  serializable2map,
  prettierLexerRest,
  cascadeASTNodeSelectorFactory,
  cascadeASTNodeFirstMatchSelectorFactory,
} from "./utils";

/**
 * @see {@link DFA.toJSON}.
 */
export type SerializableDFA<
  NTs extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
> = {
  NTs: NTs[];
  entryNTs: NTs[];
  grammars: SerializableGrammar<NTs | ExtractKinds<LexerDataBindings>>[];
  grammarRules: SerializableGrammarRule<NTs>[];
  candidates: SerializableCandidate[];
  states: SerializableState[];
  entryState: StateID;
  NTClosures: Record<NTs, GrammarRuleID[]>;
  firstSets: Record<NTs, GrammarString[]>;
  followSets: Record<NTs | ExtractKinds<LexerDataBindings>, GrammarString[]>;
  cascadeQueryPrefix?: string;
};

/**
 * DFA for ELR parsers. Stateless.
 */
export class DFA<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  private selector: ASTNodeSelector<
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  >;
  private firstMatchSelector: ASTNodeFirstMatchSelector<
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  >;

  constructor(
    readonly grammarRules: ReadonlyGrammarRuleRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    private readonly entryNTs: ReadonlySet<NTs>,
    private readonly entryState: State<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    private readonly NTClosures: ReadonlyNTClosures<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    public readonly firstSets: ReadonlyFirstSets<
      NTs,
      ExtractKinds<LexerDataBindings>
    >,
    public readonly followSets: ReadonlyFollowSets<
      NTs,
      ExtractKinds<LexerDataBindings>
    >,
    private readonly candidates: ReadonlyCandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    readonly states: ReadonlyStateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    readonly grammars: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
    readonly NTs: ReadonlySet<NTs>,
    private readonly cascadeQueryPrefix: string | undefined,
    private readonly tokenASTDataMapper: ReadonlyMap<
      ExtractKinds<LexerDataBindings>,
      TokenASTDataMapperExec<LexerDataBindings, LexerErrorType, ASTData>
    >,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
  ) {
    this.selector = cascadeASTNodeSelectorFactory(cascadeQueryPrefix);
    this.firstMatchSelector =
      cascadeASTNodeFirstMatchSelectorFactory(cascadeQueryPrefix);
  }

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >[],
    lexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>,
    reLexStack: Stack<
      ReLexState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    commitParser: () => void,
    ignoreEntryFollow: boolean,
    global: Global,
    debug: boolean,
    logger: Logger,
  ): {
    output: ParserOutput<
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >;
    trimmedLexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>;
  } {
    lexer.trim();
    return this._parse(
      {
        stateStack: new Stack([this.entryState]),
        index: 0,
        errors: [],
        buffer,
        trimmedLexer: lexer,
        startCandidateIndex: 0,
        lexedGrammars: new Set(),
      },
      reLexStack,
      rollbackStack,
      commitParser,
      ignoreEntryFollow,
      global,
      debug,
      logger,
    );
  }

  /**
   * Retrieve a parsing state using the re-lex stack.
   * Call rollbacks.
   */
  // TODO: rename to rollback?
  private _reLex(
    parsingState: ParsingState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    targetState: ReLexState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    debug: boolean,
    logger: Logger,
  ): ParsingState<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  > {
    if (debug) {
      const info = {
        restored: targetState.trimmedLexer.state.buffer.slice(
          targetState.trimmedLexer.state.digested,
          parsingState.trimmedLexer.state.digested,
        ),
      };
      logger.log({
        entity: "Parser",
        message: `re-lex, restored: ${JSON.stringify(info.restored)}`,
        info,
      });
    }

    // call rollbacks if rollback is enabled
    if (this.rollback) {
      while (rollbackStack.length > targetState.rollbackStackLength) {
        const { context, rollback } = rollbackStack.pop()!;
        rollback?.(context);
      }
    }

    // apply state
    return targetState;
  }

  private _parse(
    parsingState: ParsingState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    reLexStack: Stack<
      ReLexState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    commitParser: () => void,
    ignoreEntryFollow: boolean,
    global: Global,
    debug: boolean,
    logger: Logger,
  ) {
    while (true) {
      // if no enough AST nodes
      if (parsingState.index >= parsingState.buffer.length) {
        // try to lex a new one and update parsingState
        const res = this.tryLex(
          parsingState,
          reLexStack,
          rollbackStack,
          global,
          debug,
          logger,
        );
        if (res === undefined) {
          return {
            output: rejectedParserOutput,
            trimmedLexer: parsingState.trimmedLexer,
          };
        }
        parsingState = res;
      }

      const res = this.tryReduce(
        parsingState,
        reLexStack,
        rollbackStack,
        ignoreEntryFollow,
        global,
        debug,
        logger,
      );

      if (!res.accept) {
        parsingState = res.parsingState;
        if (res.continue) continue; // try to digest more input
        return {
          output: rejectedParserOutput,
          trimmedLexer: parsingState.trimmedLexer,
        };
      }

      if (res.commit) {
        commitParser();
      } else {
        // update rollback stack
        if (this.rollback)
          rollbackStack.push({
            rollback: res.rollback,
            context: res.context,
          });
      }
      const reduced = parsingState.buffer.length - res.buffer.length + 1; // how many nodes are digested
      parsingState.index -= reduced - 1; // digest n, generate 1
      parsingState.buffer = res.buffer;
      parsingState.errors.push(...res.errors);
      for (let i = 0; i < reduced; ++i) parsingState.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (
        this.entryNTs.has(parsingState.buffer[0].kind as NTs) &&
        parsingState.index === 0
      )
        return {
          output: {
            accept: true,
            buffer: parsingState.buffer,
            errors: parsingState.errors,
          },
          trimmedLexer: parsingState.trimmedLexer,
        };
      // if stop on error, return partial result
      // if (stopOnError && parsingState.errors.length > 0)
      //   return {
      //     output: {
      //       accept: true,
      //       buffer: parsingState.buffer,
      //       errors: parsingState.errors,
      //     },
      //     trimmedLexer: parsingState.trimmedLexer,
      //   };

      // continue loop, try to digest more with the newly reduced buffer
    }
  }

  /**
   * This is called when the buffer doesn't have enough AST nodes.
   * This will try to lex the rest input to get an expected AST node.
   *
   * Return `true` if lex success, `false` if lex failed.
   *
   * The `parsingState` will be updated if success.
   */
  private tryLex(
    parsingState: ParsingState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    reLexStack: Stack<
      ReLexState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    global: Global,
    debug: boolean,
    logger: Logger,
  ) {
    const res = this._tryLex(
      parsingState,
      reLexStack,
      rollbackStack,
      global,
      debug,
      logger,
    );
    // if no more ASTNode can be lexed
    if (res === undefined) {
      return undefined;
    } else {
      parsingState = res.parsingState;
      // apply result to the current state
      parsingState.buffer.push(res.node.asASTNode());
      parsingState.trimmedLexer = res.trimmedLexer;
      // TODO: is this logging needed? since we already logged in State.tryLex
      if (debug) {
        const info = {
          apply: parsingState.buffer.at(-1)!.toString(),
        };
        logger.log({
          entity: "Parser",
          message: `try lex: apply ${info.apply}`,
          info,
        });
      }
    }

    return parsingState;
  }

  /**
   * Try lex, if failed, try re-lex.
   *
   * Return `undefined` if all failed.
   */
  private _tryLex(
    parsingState: ParsingState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    reLexStack: Stack<
      ReLexState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    global: Global,
    debug: boolean,
    logger: Logger,
  ) {
    while (true) {
      const res = parsingState.stateStack.current!.tryLex(
        parsingState.trimmedLexer,
        this.tokenASTDataMapper,
        parsingState.startCandidateIndex,
        parsingState.lexedGrammars,
        global,
        debug,
        logger,
      );
      if (res !== undefined) {
        // if re-lex is enabled, store other possibilities for re-lex
        if (
          this.reLex &&
          res.nextCandidateIndex <
            parsingState.stateStack.current!.candidates.length
        ) {
          reLexStack.push({
            stateStack: parsingState.stateStack.clone(), // make a copy
            buffer: parsingState.buffer.slice(),
            trimmedLexer: parsingState.trimmedLexer, // use the original lexer
            index: parsingState.index,
            errors: parsingState.errors.slice(),
            rollbackStackLength: rollbackStack.length,
            lexedGrammars: new Set(parsingState.lexedGrammars), // lexedGrammars is updated, clone it
            startCandidateIndex: res.nextCandidateIndex,
          });
        }
        return { ...res, parsingState };
      }

      // try to restore from re-lex stack
      if (this.reLex && reLexStack.length > 0) {
        if (debug) {
          logger.log({
            entity: "Parser",
            message: "try lex: all candidates failed, re-lex",
          });
        }
        parsingState = this._reLex(
          parsingState,
          reLexStack.pop()!,
          rollbackStack,
          debug,
          logger,
        );
        continue;
      } else {
        // no more ASTNode can be lexed, parsing failed
        // TODO: enter panic mode, #8
        if (debug) {
          const info = {
            state: parsingState.stateStack.current!.toString(),
            rest: prettierLexerRest(parsingState.trimmedLexer),
          };
          logger.log({
            entity: "Parser",
            message: `end: no matching token can be lexed, rest: ${info.rest}, state: \n${info.state}`,
            info,
          });
        }
        return undefined;
      }
    }
  }

  private tryReduce(
    parsingState: ParsingState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    reLexStack: Stack<
      ReLexState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    rollbackStack: Stack<
      RollbackState<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >,
    ignoreEntryFollow: boolean,
    global: Global,
    debug: boolean,
    logger: Logger,
  ) {
    // try to construct next state
    const nextStateResult = parsingState.stateStack.current!.getNext(
      this.grammars,
      parsingState.buffer[parsingState.index],
    );
    if (nextStateResult.state === null) {
      // try to restore from re-lex stack
      if (this.reLex && reLexStack.length > 0) {
        parsingState = this._reLex(
          parsingState,
          reLexStack.pop()!,
          rollbackStack,
          debug,
          logger,
        );
        return { accept: false, continue: true, parsingState } as const;
      } else {
        // no more candidate can be constructed, parsing failed
        if (debug) {
          const info = {
            state: parsingState.stateStack.current!.toString(),
            node: parsingState.buffer.at(parsingState.index)!.toString(),
          };
          logger.log({
            entity: "Parser",
            message: `end: no more candidate, node: ${info.node}, state: \n${info.state}`,
            info,
          });
        }
        return { accept: false, continue: false, parsingState } as const;
      }
    }

    // next state exist, push stack
    parsingState.stateStack.push(nextStateResult.state);
    parsingState.startCandidateIndex = 0;
    parsingState.lexedGrammars.clear();

    // try reduce with the new state
    const res = parsingState.stateStack.current!.tryReduce(
      parsingState.buffer,
      this.entryNTs,
      ignoreEntryFollow,
      this.followSets,
      parsingState.trimmedLexer,
      this.selector,
      this.firstMatchSelector,
      global,
      debug,
      logger,
    );

    // rejected
    if (!res.accept) {
      parsingState.index++;
      return { accept: false, continue: true, parsingState } as const; // try to digest more
    }
    // else, accepted

    return res;
  }

  toJSON(): SerializableDFA<NTs, LexerDataBindings> {
    return {
      NTs: [...this.NTs],
      entryNTs: [...this.entryNTs],
      grammars: this.grammars.toJSON(),
      grammarRules: this.grammarRules.toJSON(),
      candidates: this.candidates.toJSON(),
      states: this.states.toJSON(),
      entryState: this.entryState.id,
      NTClosures: stringMap2serializable(this.NTClosures, (grs) =>
        grs.map((gr) => gr.id),
      ),
      firstSets: stringMap2serializable(this.firstSets, (v) => v.toJSON()),
      followSets: stringMap2serializable(this.followSets, (v) => v.toJSON()),
      cascadeQueryPrefix: this.cascadeQueryPrefix,
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
    data: SerializableDFA<NTs, LexerDataBindings>,
    tokenASTDataMapper: ReadonlyMap<
      ExtractKinds<LexerDataBindings>,
      TokenASTDataMapperExec<LexerDataBindings, LexerErrorType, ASTData>
    >,
    options: {
      logger: Logger;
      debug: boolean;
      rollback: boolean;
      reLex: boolean;
    },
  ) {
    const NTs = new Set(data.NTs);
    const grammars = GrammarRepo.fromJSON<NTs, ExtractKinds<LexerDataBindings>>(
      data.grammars,
    );
    const grs = ReadonlyGrammarRuleRepo.fromJSON<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >(data.grammarRules, grammars);
    const candidates = CandidateRepo.fromJSON<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >(data.candidates, grs, grammars);
    const states = StateRepo.fromJSON(data.states, candidates, grammars);
    const firstSets = serializable2map(data.firstSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFirstSets<NTs, ExtractKinds<LexerDataBindings>>;
    const followSets = serializable2map(data.followSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFollowSets<NTs, ExtractKinds<LexerDataBindings>>;
    const NTClosures = serializable2map(data.NTClosures, (v) =>
      v.map((s) => grs.get(s)!),
    );
    const entryState = states.get(data.entryState)!;
    return new DFA(
      grs,
      new Set(data.entryNTs),
      entryState,
      NTClosures,
      firstSets,
      followSets,
      candidates,
      states,
      grammars,
      NTs,
      data.cascadeQueryPrefix,
      tokenASTDataMapper,
      options.rollback,
      options.reLex,
    );
  }

  toMermaid() {
    const hashStr = (s: string) => {
      // use 36 radix to reduce length
      // raw may starts with '-' if negative
      const raw = hashStringToNum(s).toString(36);
      // use p/n as prefix to avoid starting with number or contains '-'
      return raw.startsWith("-") ? raw.replace("-", "n") : "p" + raw;
    };
    const escapeStateDescription = (s: string) =>
      // escape quote and newline
      `"${s.replace(/"/g, "&quot;").replace(/\n/g, "\\n")}"`;
    const escapeTransition = (s: string) =>
      `${s.replace(/./g, (i) => "#" + i.charCodeAt(0) + ";")}`;

    const res = [
      `stateDiagram-v2`,
      "direction LR",
      `[*] --> ${hashStr(this.entryState.id)}`, // entry state
    ];

    // push states & transitions
    this.states.states.forEach((c) =>
      res.push(c.toMermaid(hashStr, escapeStateDescription, escapeTransition)),
    );

    return res.join("\n");
  }
}
