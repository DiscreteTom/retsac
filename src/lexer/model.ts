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
export type Definition<ErrorType, Kinds extends string, ActionState> = {
  /** Target token kind. Empty string if anonymous. */
  kind: Kinds;
  action: Action<ErrorType, ActionState>;
};

export type ActionStateCloner<ActionState> = (
  ctx: Readonly<ActionState>,
) => ActionState;

export interface ILexerCore<ErrorType, Kinds extends string, ActionState> {
  readonly defs: readonly Readonly<Definition<ErrorType, Kinds, ActionState>>[];
  readonly initialState: Readonly<ActionState>;
  readonly state: ActionState;
  readonly stateCloner: ActionStateCloner<ActionState>;
  /**
   * Clone a new lexer core with the same definitions and the initial state.
   */
  dryClone(): ILexerCore<ErrorType, Kinds, ActionState>;
  /**
   * Clone a new lexer core with the same definitions and the current state.
   */
  clone(): ILexerCore<ErrorType, Kinds, ActionState>;
  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    options?: Readonly<{
      /**
       * From which char of the input string to start lexing.
       * @default 0
       */
      start?: number;
      /**
       * If NOT `undefined`, the value should be `input.slice(options.offset)`.
       * This is to optimize the performance if some actions need to get the rest of the input.
       * @default undefined
       */
      rest?: string;
      expect?: Readonly<{
        kind?: Kinds;
        text?: string;
      }>;
      /**
       * @default false
       */
      debug?: boolean;
      /**
       * @default defaultLogger
       */
      logger?: Logger;
      /**
       * @default "LexerCore.lex"
       */
      entity?: string;
    }>,
  ): {
    /**
     * `null` if no actions can be accepted or all muted.
     */
    token: Token<ErrorType, Kinds> | null;
    /**
     * How many chars are digested during this lex.
     */
    digested: number;
    /**
     * Not `undefined` if the last action's output contains a rest.
     */
    rest: string | undefined;
    /**
     * Accumulated errors during this lex.
     */
    errors: Token<ErrorType, Kinds>[];
  };
  trimStart(
    buffer: string,
    options?: Readonly<{
      /**
       * From which char of the input string to start lexing.
       * @default 0
       */
      start?: number;
      /**
       * If NOT `undefined`, the value should be `input.slice(options.offset)`.
       * This is to optimize the performance if some actions need to get the rest of the input.
       * @default undefined
       */
      rest?: string;
      /**
       * @default false
       */
      debug?: boolean;
      /**
       * @default defaultLogger
       */
      logger?: Logger;
      /**
       * @default "LexerCore.lex"
       */
      entity?: string;
    }>,
  ): {
    /**
     * How many chars are digested during this lex.
     */
    digested: number;
    /**
     * Not `undefined` if the last action's output contains a rest.
     */
    rest: string | undefined;
    /**
     * Accumulated errors during this lex.
     */
    errors: Token<ErrorType, Kinds>[];
  };
}

/**
 * IReadonlyLexer's states won't be changed.
 */
export interface IReadonlyLexer<ErrorType, Kinds extends string, ActionState> {
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
  get errors(): readonly Readonly<Token<ErrorType, Kinds>>[];
  readonly defs: readonly Readonly<Definition<ErrorType, Kinds, ActionState>>[];
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
  readonly core: ILexerCore<ErrorType, Kinds, ActionState>;
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<ErrorType, Kinds, ActionState>;
  /**
   * Clone a new lexer with the same definitions and the initial state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): ILexer<ErrorType, Kinds, ActionState>;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token kind/content to be accepted.
   */
  lex(
    options: Readonly<{
      input?: string;
      expect?: Readonly<{
        kind?: Kinds;
        text?: string;
      }>;
      // readonly lex, must set peek to true
      peek: true;
    }>,
  ): Token<ErrorType, Kinds> | null;
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

export interface ILexer<ErrorType, Kinds extends string, ActionState>
  extends IReadonlyLexer<ErrorType, Kinds, ActionState> {
  get errors(): Readonly<Token<ErrorType, Kinds>>[]; // make the array writable
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
        kind?: Kinds;
        text?: string;
      }>;
      /**
       * If `true`, the lexer will not update its state.
       * Default: `false`.
       */
      peek?: boolean;
    }>,
  ): Token<ErrorType, Kinds> | null;
  lex(input?: string): Token<ErrorType, Kinds> | null;
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
  }): Token<ErrorType, Kinds>[];
  lexAll(input?: string): Token<ErrorType, Kinds>[];
}
