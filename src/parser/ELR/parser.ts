import type { ILexer } from "../../lexer";
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> implements IParser<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
{
  lexer: ILexer<LexerError, LexerKinds>;
  readonly dfa: DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
  private _buffer: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  readonly errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];

  private reLexStack: ReLexState<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];
  /**
   * There will only be one rollback stack for a parser.
   * Every reduce will push a rollback state to this stack.
   *
   * Re-lex will only pop this stack, they don't need to store or restore the stack.
   */
  private rollbackStack: RollbackState<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];

  get buffer() {
    return this._buffer as readonly ASTNode<
      ASTData,
      ErrorType,
      Kinds | LexerKinds
    >[];
  }

  debug: boolean;
  logger: Logger;
  autoCommit: boolean;
  ignoreEntryFollow: boolean;

  constructor(
    dfa: DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    lexer: ILexer<LexerError, LexerKinds>,
    autoCommit: boolean,
    ignoreEntryFollow: boolean,
    debug: boolean,
    logger: Logger,
  ) {
    this.dfa = dfa;
    this.lexer = lexer;
    this._buffer = [];
    this.errors = [];
    this.reLexStack = [];
    this.rollbackStack = [];
    this.autoCommit = autoCommit;
    this.ignoreEntryFollow = ignoreEntryFollow;
    this.debug = debug;
    this.logger = logger;
  }

  /** Clear re-lex stack (abandon all other possibilities). */
  commit() {
    this.reLexStack.length = 0; // clear re-lex stack
    this.rollbackStack.length = 0; // clear rollback stack
    return this;
  }

  reset() {
    // this.dfa.reset(); // DFA is stateless so no need to reset
    this.lexer.reset();
    this._buffer = [];
    this.errors.length = 0;
    return this.commit();
  }

  // TODO: remove options? rename it to `override`? allow more options?
  clone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Parser<ASTData, ErrorType, Kinds, LexerKinds, LexerError>(
      this.dfa,
      this.lexer.clone(),
      this.autoCommit,
      this.ignoreEntryFollow,
      options?.debug ?? this.debug,
      options?.logger ?? this.logger,
    );
    res._buffer = [...this._buffer];
    res.errors.push(...this.errors);
    res.reLexStack = [...this.reLexStack];
    res.rollbackStack = [...this.rollbackStack];
    return res;
  }

  dryClone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Parser<ASTData, ErrorType, Kinds, LexerKinds, LexerError>(
      this.dfa,
      this.lexer.dryClone(),
      this.autoCommit,
      this.ignoreEntryFollow,
      options?.debug ?? this.debug,
      options?.logger ?? this.logger,
    );
    return res;
  }

  feed(input: string) {
    this.lexer.feed(input);
    return this;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  take(n: number = 1) {
    this.commit();
    return this._buffer.splice(0, n);
  }

  parse(
    input?: string | { input?: string; stopOnError?: boolean },
  ): ParserOutput<ASTData, ErrorType, Kinds | LexerKinds> {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input?.stopOnError ?? false;

    // important! make sure lexer can still lex something not muted.
    // DON'T put this in `DFA.parse` because we need to update lexer using `trimStart`.
    // If we put this in `DFA.parse` and parse failed, the lexer won't be updated.
    if (!this.lexer.trimStart().hasRest()) return { accept: false };

    while (true) {
      const res = this.dfa.parse(
        this._buffer,
        this.lexer.clone(), // clone lexer to avoid DFA changing the original lexer
        this.reLexStack,
        this.rollbackStack,
        () => this.commit(),
        stopOnError,
        this.ignoreEntryFollow,
        this.debug,
        this.logger,
      );
      if (res.output.accept) {
        // lexer is stateful and may be changed in DFA(e.g. restore from reLexStack)
        // so we need to update it using `res.lexer`
        this.lexer = res.lexer;
        this._buffer = res.output.buffer.slice(); // make a copy of buffer
        this.errors.push(...res.output.errors);

        if (this.autoCommit) this.commit();
      }
      return res.output;
    }
  }

  parseAll(
    input: string | { input?: string; stopOnError?: boolean } = "",
  ): ParserOutput<ASTData, ErrorType, Kinds | LexerKinds> {
    let buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[] = [];
    /** Aggregate results if the parser can accept more. */
    const errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[] = [];
    /** If the parser has accepted at least once. */
    let accepted = false;

    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input?.stopOnError ?? false;

    while (true) {
      const res = this.parse({ stopOnError });
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
