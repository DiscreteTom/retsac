import type { GeneralTokenDataBinding, Token } from "./token";

/**
 * The inner state of a lexer.
 * All fields are readonly. You can only modify them by calling methods.
 */
export interface ILexerState<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> {
  /**
   * The entire input string.
   */
  readonly buffer: string;
  /**
   * How many chars are digested.
   */
  readonly digested: number;
  /**
   * How many chars in each line.
   */
  readonly lineChars: readonly number[];
  /**
   * `true` if the lexer is `trimStart`-ed.
   */
  readonly trimmed: boolean;
  /**
   * Currently accumulated errors.
   */
  readonly errors: Readonly<Token<DataBindings, ErrorType>>[];
  readonly rest: string | undefined;

  /**
   * Reset the lexer's state.
   */
  reset(): void;
  /**
   * Append new input to the end of the buffer and update related states.
   */
  feed(input: string): void;
  /**
   * Take `n` chars from the buffer and update related states.
   * The caller should ensure the `n` is valid (greater or equal to 0), and provide the content.
   *
   * If the caller can get the rest unintentionally, it can be passed to the `rest` parameter.
   */
  take(n: number, content: string, rest: string | undefined): void;
  clone(): ILexerState<DataBindings, ErrorType>;
  /**
   * Set `trimmed` to `true`.
   */
  setTrimmed(): void;
  /**
   * Get the un-digested string buffer.
   * The rest string might be very long, be care of using this method.
   * The result will be cached in the lexer state and will be auto invalidated when the state is changed.
   */
  getRest(): string;
}
