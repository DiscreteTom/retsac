import { Logger } from "../model";
import { Action } from "./action";

/** The output of a lexer. */
export type Token<E> = {
  /** User-defined token kind name. */
  kind: string;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  error?: E;
};

/** Apply `action` and try to yield a token with `kind`. */
export type Definition<E> = {
  /** Target token kind. Empty string if anonymous. */
  kind: string;
  action: Action<E>;
};

export interface ILexer<E> {
  /**
   * When `debug` is `true`, the lexer will use `logger` to log debug info.
   * Default: `false`.
   */
  debug: boolean;
  /**
   * The logger used when `debug` is `true`.
   * Default: `console.log`.
   */
  logger: Logger;
  /**
   * Currently accumulated errors.
   * You can clear the errors by setting it's length to 0.
   */
  readonly errors: Token<E>[];
  get defs(): readonly Readonly<Definition<E>>[];
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
   * Reset the lexer's state, only keep the definitions.
   */
  reset(): this;
  /**
   * Clone a new lexer with the same state and definitions.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(options?: { debug?: boolean; logger?: Logger }): ILexer<E>;
  /**
   * Clone a new lexer with the same definitions, without states.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(options?: { debug?: boolean; logger?: Logger }): ILexer<E>;
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
    }
  ): string;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token kind/content to be accepted.
   */
  lex(
    input?:
      | string
      | Readonly<{
          input?: string;
          expect?: Readonly<{
            kind?: string;
            text?: string;
          }>;
        }>
  ): Token<E> | null;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(
    input?: string | { input?: string; stopOnError?: boolean }
  ): Token<E>[];
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
  getTokenKinds(): Set<string>;
  /**
   * Get line number (starts from 1) and column number (starts from 1)
   * from the index (starts from 0) of the input string.
   */
  getPos(index: number): { line: number; column: number };
  hasErrors(): boolean;
}
