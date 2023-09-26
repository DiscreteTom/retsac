import type { Logger } from "../logger";
import type { Action } from "./action";

/** The output of a lexer. */
export type Token<ErrorType, Kinds extends string> = {
  /** User-defined token kind name. */
  kind: Kinds;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  error?: ErrorType;
};

/** Apply `action` and try to yield a token with `kind`. */
export type Definition<ErrorType, Kinds extends string> = {
  /** Target token kind. Empty string if anonymous. */
  kind: Kinds;
  action: Action<ErrorType>;
};

/**
 * ReadonlyILexer's states won't be changed.
 */
export interface IReadonlyLexer<ErrorType, Kinds extends string> {
  /**
   * When `debug` is `true`, the lexer will use `logger` to log debug info.
   * Default: `false`.
   */
  get debug(): boolean;
  /**
   * The logger used when `debug` is `true`.
   * Default: `console.log`.
   */
  get logger(): Logger;
  /**
   * Currently accumulated errors.
   * You can clear the errors by setting it's length to 0.
   */
  readonly errors: Token<ErrorType, Kinds>[];
  get defs(): readonly Readonly<Definition<ErrorType, Kinds>>[];
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
   * Clone a new lexer with the same state and definitions.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<ErrorType, Kinds>;
  /**
   * Clone a new lexer with the same definitions, without states.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<ErrorType, Kinds>;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token kind/content to be accepted.
   */
  lex(
    input: Readonly<{
      input?: string;
      expect?: Readonly<{
        kind?: string;
        text?: string;
      }>;
      // readonly lex, must set peek to true
      peek: true;
    }>,
  ): Token<ErrorType, Kinds> | null;
  /**
   * Remove ignored chars from the start of the rest of buffer.
   */
  trimStart(input?: string): this;
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
  getTokenKinds(): Set<Kinds>;
  /**
   * Get line number (starts from 1) and column number (starts from 1)
   * from the index (starts from 0) of the input string.
   */
  getPos(index: number): { line: number; column: number };
  hasErrors(): boolean;
}

export interface ILexer<ErrorType, Kinds extends string>
  extends IReadonlyLexer<ErrorType, Kinds> {
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
    input?:
      | string
      | Readonly<{
          input?: string;
          expect?: Readonly<{
            kind?: string;
            text?: string;
          }>;
          /**
           * If `true`, the lexer will not update its state.
           * Default: `false`.
           */
          peek?: boolean;
        }>,
  ): Token<ErrorType, Kinds> | null;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(
    input?: string | { input?: string; stopOnError?: boolean },
  ): Token<ErrorType, Kinds>[];
}
