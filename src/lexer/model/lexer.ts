import type { Logger } from "../../logger";
import type { ILexerCore } from "./core";
import type { ExtractAllDefinitions, ExtractKinds } from "./extractor";
import type { GeneralTokenDataBinding, Token } from "./token";

/**
 * IReadonlyLexer's states won't be changed.
 */
export interface IReadonlyLexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  /**
   * When `debug` is `true`, the lexer will use `logger` to log debug info.
   * Default: `false`.
   */
  get debug(): boolean;
  /**
   * The logger used when `debug` is `true`.
   * Default: `defaultLogger`.
   */
  get logger(): Logger;
  /**
   * Currently accumulated errors.
   * You can clear the errors by setting it's length to 0.
   */
  get errors(): readonly Readonly<Token<DataBindings, ErrorType>>[];
  // TODO: simplify by ref to ILexerCore
  readonly defs: ExtractAllDefinitions<DataBindings, ActionState, ErrorType>;
  /**
   * The entire input string.
   */
  get buffer(): string;
  /**
   * How many chars are digested.
   */
  get digested(): number;
  /**
   * Get how many chars in each line.
   */
  get lineChars(): readonly number[];
  /**
   * `true` if the lexer is trimStart-ed.
   */
  get trimmed(): boolean;
  readonly core: ILexerCore<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer with the same definitions and the initial state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<DataBindings, ActionState, ErrorType>;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token kind/content to be accepted.
   */
  lex(
    options: Readonly<{
      input?: string;
      expect?: Readonly<{
        kind?: ExtractKinds<DataBindings>;
        text?: string;
      }>;
      // readonly lex, must set peek to true
      peek: true;
    }>,
  ): Token<DataBindings, ErrorType> | null;
  /**
   * Get the un-lexed string buffer.
   * The rest string might be very long, be care of using this method.
   * The result will be cached in the lexer until its state is changed.
   */
  getRest(): string;
  /**
   * The rest of buffer not empty.
   */
  hasRest(): boolean;
  /**
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<ExtractKinds<DataBindings>>;
  /**
   * Get line number (starts from 1) and column number (starts from 1)
   * from the index (starts from 0) of the input string.
   */
  getPos(index: number): { line: number; column: number };
  hasErrors(): boolean;
}

export interface ILexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends IReadonlyLexer<DataBindings, ActionState, ErrorType> {
  get errors(): Readonly<Token<DataBindings, ErrorType>>[]; // make the array mutable
  set debug(value: boolean);
  set logger(value: Logger);
  /**
   * Reset the lexer's state, only keep the definitions.
   */
  reset(): this;
  /** Append buffer with input. */
  feed(input: string): this;
  /**
   * Take `n` chars from the rest of buffer and update state.
   * This is useful when you have external logic to handle the token (e.g. error handling).
   */
  take(n?: number): string;
  /**
   * Take chars from the rest of buffer and update state until `pattern` matches.
   * The pattern will be included in the result.
   * This is useful when you have external logic to handle the token (e.g. error handling).
   */
  takeUntil(
    pattern: string | RegExp,
    options?: {
      /**
       * Auto add the `global` flag to the regex if `g` and 'y' is not set.
       * Default: `true`.
       */
      autoGlobal?: boolean;
    },
  ): string;
  lex(
    options: Readonly<{
      input?: string;
      expect?: Readonly<{
        kind?: ExtractKinds<DataBindings>;
        text?: string;
      }>;
      /**
       * If `true`, the lexer will not update its state.
       * Default: `false`.
       */
      peek?: boolean;
    }>,
  ): Token<DataBindings, ErrorType> | null;
  lex(input?: string): Token<DataBindings, ErrorType> | null;
  /**
   * Remove ignored chars from the start of the rest of buffer.
   */
  trimStart(input?: string): this;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(options: {
    input?: string;
    stopOnError?: boolean;
  }): Token<DataBindings, ErrorType>[];
  lexAll(input?: string): Token<DataBindings, ErrorType>[];
}
