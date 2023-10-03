import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ASTNode } from "../../ast";
import type { ParserOutput } from "../../output";
import { rejectedParserOutput } from "../../output";
import { GrammarRepo, ReadonlyGrammarRuleRepo, GrammarSet } from "../model";
import type { ParsingState, ReLexState, RollbackState } from "../model";
import { hashStringToNum } from "../utils";
import type { ReadonlyCandidateRepo } from "./candidate";
import { CandidateRepo } from "./candidate";
import type {
  ReadonlyFirstSets,
  ReadonlyFollowSets,
  ReadonlyNTClosures,
} from "./model";
import type { ReadonlyStateRepo, State } from "./state";
import { StateRepo } from "./state";
import {
  stringMap2serializable,
  serializable2map,
  prettierLexerRest,
} from "./utils";

/**
 * DFA for ELR parsers. Stateless.
 */
export class DFA<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  constructor(
    readonly grammarRules: ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    private readonly entryNTs: ReadonlySet<Kinds>,
    private readonly entryState: State<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    private readonly NTClosures: ReadonlyNTClosures<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    public readonly firstSets: ReadonlyFirstSets<Kinds, LexerKinds>,
    public readonly followSets: ReadonlyFollowSets<Kinds, LexerKinds>,
    private readonly candidates: ReadonlyCandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    readonly states: ReadonlyStateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    readonly grammars: GrammarRepo<Kinds, LexerKinds>,
    readonly NTs: ReadonlySet<Kinds>,
    private readonly cascadeQueryPrefix: string | undefined,
    public readonly rollback: boolean,
    public readonly reLex: boolean,
  ) {}

  /**
   * Try to yield an entry NT.
   */
  parse(
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    lexer: ILexer<LexerError, LexerKinds>,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    commitParser: () => void,
    stopOnError: boolean,
    ignoreEntryFollow: boolean,
    debug: boolean,
    logger: Logger,
  ): {
    output: ParserOutput<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<LexerError, LexerKinds>;
  } {
    return this._parse(
      {
        stateStack: [this.entryState],
        index: 0,
        errors: [],
        buffer,
        lexer,
      },
      reLexStack,
      rollbackStack,
      commitParser,
      stopOnError,
      ignoreEntryFollow,
      debug,
      logger,
    );
  }

  /**
   * Set the parsing state using the re-lex stack's top state.
   *
   * Before re-lex, the caller should make sure the reLexStack is not empty!
   */
  private _reLex(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    debug: boolean,
    logger: Logger,
  ) {
    const targetState = reLexStack.pop()!;

    if (debug) {
      const info = {
        trying: targetState.buffer.at(-1)!.toString(),
        restored:
          targetState.buffer.at(-1)!.text +
          targetState.lexer.buffer.slice(
            targetState.lexer.digested,
            parsingState.lexer.digested,
          ),
      };
      logger.log({
        entity: "Parser",
        message: `re-lex, restored: ${JSON.stringify(info.restored)}, trying: ${
          info.trying
        }`,
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
    parsingState.stateStack = targetState.stateStack;
    parsingState.buffer = targetState.buffer;
    parsingState.index = targetState.index;
    parsingState.lexer = targetState.lexer;
    parsingState.errors = targetState.errors;
  }

  private _parse(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    commitParser: () => void,
    stopOnError: boolean,
    ignoreEntryFollow: boolean,
    debug: boolean,
    logger: Logger,
  ) {
    while (true) {
      // if no enough AST nodes, try to lex a new one
      if (parsingState.index >= parsingState.buffer.length) {
        if (
          !this.tryLex(parsingState, reLexStack, rollbackStack, debug, logger)
        ) {
          return { output: rejectedParserOutput, lexer: parsingState.lexer };
        }
      }

      const res = this.tryReduce(
        parsingState,
        reLexStack,
        rollbackStack,
        ignoreEntryFollow,
        debug,
        logger,
      );

      if (!res.accept) {
        if (res.continue) continue; // try to digest more input
        return { output: rejectedParserOutput, lexer: parsingState.lexer };
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
        this.entryNTs.has(parsingState.buffer[0].kind as Kinds) &&
        parsingState.index == 0
      )
        return {
          output: {
            accept: true,
            buffer: parsingState.buffer,
            errors: parsingState.errors,
          },
          lexer: parsingState.lexer,
        };
      // if stop on error, return partial result
      if (stopOnError && parsingState.errors.length > 0)
        return {
          output: {
            accept: true,
            buffer: parsingState.buffer,
            errors: parsingState.errors,
          },
          lexer: parsingState.lexer,
        };

      // continue loop, try to digest more with the newly reduced buffer
    }
  }

  /**
   * This is called when the buffer doesn't have enough AST nodes.
   * This will try to lex the rest input to get an expected AST node.
   *
   * Return `true` if lex success, `false` if lex failed.
   */
  private tryLex(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    debug: boolean,
    logger: Logger,
  ) {
    // end of buffer, try to lex input string to get next ASTNode
    const res = parsingState.stateStack
      .at(-1)!
      .tryLex(parsingState.lexer, debug, logger);
    // if no more ASTNode can be lexed
    if (res.length == 0) {
      // try to restore from re-lex stack
      if (this.reLex && reLexStack.length > 0) {
        if (debug) {
          logger.log({
            entity: "Parser",
            message: "try lex: all candidates failed, try to re-lex",
          });
        }
        this._reLex(parsingState, reLexStack, rollbackStack, debug, logger);
      } else {
        // no more ASTNode can be lexed, parsing failed
        if (debug) {
          const info = {
            state: parsingState.stateStack.at(-1)!.toString(),
            rest: prettierLexerRest(parsingState.lexer),
          };
          logger.log({
            entity: "Parser",
            message: `end: no matching token can be lexed, rest: ${info.rest}, state: \n${info.state}`,
            info,
          });
        }
        return false;
      }
    } else {
      // lex success, record all possible lexing results for later use
      // we need to append reLexStack reversely, so that the first lexing result is at the top of the stack
      if (this.reLex) {
        for (let i = res.length - 1; i >= 0; --i) {
          reLexStack.push({
            stateStack: parsingState.stateStack.slice(), // make a copy
            buffer: parsingState.buffer.slice().concat(res[i].node),
            lexer: res[i].lexer,
            index: parsingState.index,
            errors: parsingState.errors.slice(),
            rollbackStackLength: rollbackStack.length,
          });
        }
        if (debug) {
          if (res.length > 1) {
            const info = {
              others: res.slice(1).map((r) => r.node.strWithoutName.value),
            };
            logger.log({
              entity: "Parser",
              message: `try lex: store other possibilities for re-lex:\n${info.others.join(
                "\n",
              )}`,
            });
          }
        }
        // use the first lexing result to continue parsing
        const state = reLexStack.pop()!;
        parsingState.buffer = state.buffer;
        parsingState.lexer = state.lexer;
      } else {
        // use the first lexing result to continue parsing
        parsingState.buffer = parsingState.buffer.concat(res[0].node);
        parsingState.lexer = res[0].lexer;
      }
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

    return true;
  }

  private tryReduce(
    parsingState: ParsingState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >,
    reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[],
    rollbackStack: RollbackState<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
    ignoreEntryFollow: boolean,
    debug: boolean,
    logger: Logger,
  ) {
    // try to construct next state
    const nextStateResult = parsingState.stateStack
      .at(-1)!
      .getNext(this.grammars, parsingState.buffer[parsingState.index]);
    if (nextStateResult.state == null) {
      // try to restore from re-lex stack
      if (this.reLex && reLexStack.length > 0) {
        this._reLex(parsingState, reLexStack, rollbackStack, debug, logger);
        return { accept: false, continue: true } as const;
      } else {
        // no more candidate can be constructed, parsing failed
        if (debug) {
          const info = {
            state: parsingState.stateStack.at(-1)!.toString(),
            node: parsingState.buffer.at(parsingState.index)!.toString(),
          };
          logger.log({
            entity: "Parser",
            message: `end: no more candidate, node: ${info.node}, state: \n${info.state}`,
            info,
          });
        }
        return { accept: false, continue: false } as const;
      }
    }

    // next state exist, push stack
    parsingState.stateStack.push(nextStateResult.state);

    // try reduce with the new state
    const res = parsingState.stateStack
      .at(-1)!
      .tryReduce(
        parsingState.buffer,
        this.entryNTs,
        ignoreEntryFollow,
        this.followSets,
        parsingState.lexer,
        this.cascadeQueryPrefix,
        debug,
        logger,
      );

    // rejected
    if (!res.accept) {
      parsingState.index++;
      return { accept: false, continue: true } as const; // try to digest more
    }
    // else, accepted

    return res;
  }

  toJSON() {
    return {
      NTs: [...this.NTs],
      entryNTs: [...this.entryNTs],
      grammars: this.grammars.toJSON(),
      grammarRules: this.grammarRules.toSerializable(this.grammars),
      candidates: this.candidates.toSerializable(
        this.grammarRules,
        this.grammars,
      ),
      states: this.states.toSerializable(this.candidates, this.grammars),
      entryState: this.states.getKey(this.entryState),
      NTClosures: stringMap2serializable(this.NTClosures, (grs) =>
        grs.map((gr) => this.grammarRules.getKey(gr)),
      ),
      firstSets: stringMap2serializable(this.firstSets, (v) =>
        v.toSerializable(this.grammars),
      ),
      followSets: stringMap2serializable(this.followSets, (v) =>
        v.toSerializable(this.grammars),
      ),
      cascadeQueryPrefix: this.cascadeQueryPrefix,
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
      DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>["toJSON"]
    >,
    options: {
      logger: Logger;
      debug: boolean;
      rollback: boolean;
      reLex: boolean;
    },
  ) {
    const NTs = new Set(data.NTs);
    const grammars = GrammarRepo.fromJSON<Kinds, LexerKinds>(data.grammars);
    const grs = ReadonlyGrammarRuleRepo.fromJSON<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >(data.grammarRules, grammars);
    const candidates = CandidateRepo.fromJSON<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >(data.candidates, grs, grammars);
    const states = StateRepo.fromJSON(data.states, candidates, grammars);
    const firstSets = serializable2map(data.firstSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFirstSets<Kinds, LexerKinds>;
    const followSets = serializable2map(data.followSets, (v) =>
      GrammarSet.fromJSON(v, grammars),
    ) as ReadonlyFollowSets<Kinds, LexerKinds>;
    const NTClosures = serializable2map(data.NTClosures, (v) =>
      v.map((s) => grs.getByString(s)!),
    );
    const entryState = states.getByString(data.entryState)!;
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
      `[*] --> ${hashStr(this.entryState.str)}`, // entry state
    ];

    // push states & transitions
    this.states.states.forEach((c) =>
      res.push(c.toMermaid(hashStr, escapeStateDescription, escapeTransition)),
    );

    return res.join("\n");
  }
}
