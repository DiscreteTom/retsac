import { Stack } from "../../helper/stack";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  IToken,
} from "../../lexer";
import type { Logger } from "../../logger";
import type { ASTNode } from "../ast";
import type { IParser } from "../model";
import type { ParserOutput } from "../output";
import type { DFA } from "./DFA";
import type { ReLexState, RollbackState } from "./model";

/**
 * ELR parser.
 */
export class Parser<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> implements
    IParser<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
{
  trimmedLexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>;
  readonly dfa: DFA<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  private _buffer: ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  >[];
  readonly errors: ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  >[];

  private reLexStack: Stack<
    ReLexState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;
  /**
   * There will only be one rollback stack for a parser.
   * Every reduce will push a rollback state to this stack.
   *
   * Re-lex will only pop this stack, they don't need to store or restore the stack.
   */
  private rollbackStack: Stack<
    RollbackState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;

  get buffer() {
    return this._buffer as readonly ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >[];
  }

  private _global: Global;
  private globalFactory: () => Global;
  get global() {
    return this._global;
  }

  debug: boolean;
  logger: Logger;
  autoCommit: boolean;
  ignoreEntryFollow: boolean;

  constructor(
    dfa: DFA<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    lexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>,
    autoCommit: boolean,
    ignoreEntryFollow: boolean,
    globalFactory: () => Global,
    debug: boolean,
    logger: Logger,
  ) {
    lexer.trim();
    this.dfa = dfa;
    this.trimmedLexer = lexer;
    this._buffer = [];
    this.errors = [];
    this.reLexStack = new Stack();
    this.rollbackStack = new Stack();
    this.autoCommit = autoCommit;
    this.ignoreEntryFollow = ignoreEntryFollow;
    this.globalFactory = globalFactory;
    this._global = globalFactory();
    this.debug = debug;
    this.logger = logger;
  }

  reload(buffer: string): this {
    this.trimmedLexer.reload(buffer);
    this.trimmedLexer.trim();

    // reset other states
    this._buffer = [];
    this.errors.length = 0;
    this.reLexStack.clear();
    this.rollbackStack.clear();
    this._global = this.globalFactory();
    return this;
  }

  /** Clear re-lex stack (abandon all other possibilities). */
  commit() {
    this.reLexStack.clear();
    this.rollbackStack.clear();
    return this;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  take(n: number = 1) {
    this.commit();
    return this._buffer.splice(0, n);
  }

  parse(): ParserOutput<
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  > {
    // important! make sure lexer can still lex something not muted.
    // DON'T put this in `DFA.parse` because we need to update lexer using `trimStart`.
    // If we put this in `DFA.parse` and parse failed, the lexer won't be updated.
    if (!this.trimmedLexer.state.hasRest()) return { accept: false };

    while (true) {
      const res = this.dfa.parse(
        // all these parameters may be changed in DFA
        // so we don't need to clone them here
        this._buffer,
        this.trimmedLexer,
        this.reLexStack,
        this.rollbackStack,
        () => this.commit(),
        this.ignoreEntryFollow,
        this._global,
        this.debug,
        this.logger,
      );
      if (res.output.accept) {
        // TODO: DFA should return other states like reLexStack and rollbackStack
        this.trimmedLexer = res.trimmedLexer;
        this._buffer = res.output.buffer;
        this.errors.push(...res.output.errors);

        if (this.autoCommit) this.commit();
      }
      return res.output;
    }
  }

  parseAll(): ParserOutput<
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  > {
    let buffer: ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >[] = [];
    /** Aggregate results if the parser can accept more. */
    const errors: ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      IToken<LexerDataBindings, LexerErrorType>,
      Global
    >[] = [];
    /** If the parser has accepted at least once. */
    let accepted = false;

    while (true) {
      const res = this.parse();
      if (res.accept) {
        accepted = true;
        buffer = res.buffer;
        errors.push(...res.errors);
      } else {
        if (accepted) {
          // at least one accept
          return { accept: true, buffer, errors };
        } else {
          return res;
        }
      }
    }
  }
}
