import type { Logger } from "../../logger";
import type {
  ILexerCore,
  ILexerCoreLexOptions,
  IReadonlyLexerCore,
} from "./core";
import type { ILexerState } from "./state";
import type { GeneralTokenDataBinding, Token } from "./token";

export type ILexerLexOptions<DataBindings extends GeneralTokenDataBinding> = {
  /**
   * The input string to be append to the buffer.
   * @default undefined
   */
  input?: string;
} & Partial<Pick<ILexerCoreLexOptions<DataBindings>, "expect" | "peek">>;

export type ILexerCloneOptions = {
  debug?: boolean;
  logger?: Logger;
};

/**
 * IReadonlyLexer's states won't be changed.
 */
export interface IReadonlyLexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends Pick<
      IReadonlyLexerCore<DataBindings, ActionState, ErrorType>,
      "getTokenKinds"
    >,
    Pick<
      ILexerState<DataBindings, ErrorType>,
      "buffer" | "digested" | "lineChars" | "trimmed" | "getRest"
    > {
  readonly core: IReadonlyLexerCore<DataBindings, ActionState, ErrorType>;
  /**
   * When `debug` is `true`, the lexer will use `logger` to log debug info.
   * @default false
   */
  get debug(): boolean;
  /**
   * The logger used when `debug` is `true`.
   * @default defaultLogger
   */
  get logger(): Logger;
  /**
   * Currently accumulated errors.
   */
  get errors(): readonly Readonly<Token<DataBindings, ErrorType>>[];
  /**
   * Get how many chars in each line.
   */
  get lineChars(): readonly number[];
  /**
   * Clone a new lexer with the same definitions and the initial state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(
    options?: ILexerCloneOptions,
  ): ITrimmedLexer<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(
    options?: ILexerCloneOptions,
  ): ILexer<DataBindings, ActionState, ErrorType>;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token kind/content to be accepted.
   */
  lex(
    options: Readonly<ILexerLexOptions<DataBindings>> & { peek: true },
  ): Token<DataBindings, ErrorType> | null;
  /**
   * The rest of buffer not empty.
   */
  hasRest(): boolean;
  /**
   * Get 1-based line number and 1-based column number
   * from the 0-based index of the whole input string.
   */
  getPos(
    /**
     * 0-based index of the whole input string.
     */
    index: number,
  ): {
    /**
     * 1-based line number.
     */
    line: number;
    /**
     * 1-based column number.
     */
    column: number;
  };
  hasErrors(): boolean;
}

export interface ILexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends IReadonlyLexer<DataBindings, ActionState, ErrorType> {
  /**
   * Return this as a readonly lexer.
   */
  get readonly(): IReadonlyLexer<DataBindings, ActionState, ErrorType>;
  readonly core: ILexerCore<DataBindings, ActionState, ErrorType>; // make core mutable
  /**
   * Currently accumulated errors.
   * You can clear the errors by setting it's length to 0.
   */
  get errors(): Readonly<Token<DataBindings, ErrorType>>[]; // make the array mutable
  set debug(value: boolean);
  set logger(value: Logger);
  /**
   * Reset the lexer's state.
   */
  reset(): ITrimmedLexer<DataBindings, ActionState, ErrorType>;
  /**
   * Append buffer with input.
   */
  feed(input: string): this;
  /**
   * Take at most `n` chars from the rest of buffer and update state.
   * This is useful when you have external logic to handle the token (e.g. error handling).
   *
   * If `n` is larger than the length of the rest of buffer, the rest of buffer will be taken (might be an empty string).
   *
   * By default the lexer's action state will be reset, unless you provide `state`, or the `n` is invalid (smaller than 1).
   */
  take(
    /**
     * @default 1
     */
    n?: number,
    /**
     * @default undefined
     */
    state?: ActionState,
  ): string;
  /**
   * Take chars from the rest of buffer and update state until `pattern` matches.
   * The pattern will be included in the result.
   * This is useful when you have external logic to handle the token (e.g. error handling).
   *
   * By default the lexer's action state will be reset, unless you provide `options.state`, or nothing is taken.
   */
  takeUntil(
    pattern: string | RegExp,
    options?: {
      /**
       * Auto add the `global` flag to the regex if `g` and 'y' is not set.
       * @default true
       */
      autoGlobal?: boolean;
      /**
       * If provided, the lexer's action state will be updated to this value.
       * Otherwise the lexer's action state will be reset.
       * @default undefined
       */
      state?: ActionState;
    },
  ): string;
  lex(
    options: Readonly<ILexerLexOptions<DataBindings>>,
  ): Token<DataBindings, ErrorType> | null;
  lex(input?: string): Token<DataBindings, ErrorType> | null;
  /**
   * Remove ignored chars from the start of the rest of buffer.
   */
  trimStart(
    input?: string,
  ): ITrimmedLexer<DataBindings, ActionState, ErrorType>;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(options: {
    input?: string;
    stopOnError?: boolean;
  }): Token<DataBindings, ErrorType>[];
  lexAll(input?: string): Token<DataBindings, ErrorType>[];
}

export interface IReadonlyTrimmedLexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends Pick<
    IReadonlyLexer<DataBindings, ActionState, ErrorType>,
    | "buffer"
    | "core"
    | "debug"
    | "digested"
    | "dryClone"
    | "errors"
    | "getPos"
    | "getRest"
    | "getTokenKinds"
    | "hasErrors"
    | "hasRest"
    | "lex"
    | "lineChars"
    | "logger"
  > {
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(
    options?: ILexerCloneOptions,
  ): ITrimmedLexer<DataBindings, ActionState, ErrorType>;
  readonly trimmed: true;
}

export interface ITrimmedLexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends Pick<
    ILexer<DataBindings, ActionState, ErrorType>,
    | "buffer"
    | "core"
    | "debug"
    | "digested"
    | "dryClone"
    | "errors"
    | "feed"
    | "getPos"
    | "getRest"
    | "getTokenKinds"
    | "hasErrors"
    | "hasRest"
    | "lex"
    | "lexAll"
    | "lineChars"
    | "logger"
    | "readonly"
    | "reset"
    | "take"
    | "takeUntil"
    | "trimStart"
  > {
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(
    options?: ILexerCloneOptions,
  ): ITrimmedLexer<DataBindings, ActionState, ErrorType>;
  readonly trimmed: true;
}
