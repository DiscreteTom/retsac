import type { Logger } from "../../logger";
import type { ActionStateCloner } from "../action";
import type { ExtractAllDefinitions, ExtractKinds } from "./extractor";
import type { GeneralTokenDataBinding, Token } from "./token";

export interface IReadonlyLexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  readonly defs: ExtractAllDefinitions<DataBindings, ActionState, ErrorType>;
  readonly initialState: Readonly<ActionState>;
  get state(): Readonly<ActionState>;
  readonly stateCloner: ActionStateCloner<ActionState>;
  /**
   * Clone a new lexer core with the same definitions and the initial state.
   */
  dryClone(): ILexerCore<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer core with the same definitions and the current state.
   */
  clone(): ILexerCore<DataBindings, ActionState, ErrorType>;
  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    // readonly lex, must set peek to true
    options: Readonly<{
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
        kind?: ExtractKinds<DataBindings>;
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
      /**
       * @default false
       */
      peek?: true; // readonly lex, must set peek to true
    }>,
  ): {
    /**
     * `null` if no actions can be accepted or all muted.
     */
    token: Token<DataBindings, ErrorType> | null;
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
    errors: Token<DataBindings, ErrorType>[];
  };
}

export interface ILexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends IReadonlyLexerCore<DataBindings, ActionState, ErrorType> {
  get state(): ActionState; // make the state mutable
  reset(): this;
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
        kind?: ExtractKinds<DataBindings>;
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
      /**
       * @default false
       */
      peek?: boolean;
    }>,
  ): {
    /**
     * `null` if no actions can be accepted or all muted.
     */
    token: Token<DataBindings, ErrorType> | null;
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
    errors: Token<DataBindings, ErrorType>[];
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
    errors: Token<DataBindings, ErrorType>[];
  };
}
