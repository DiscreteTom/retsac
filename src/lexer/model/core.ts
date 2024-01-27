import type { Logger } from "../../logger";
import type { ActionStateCloner } from "../action";
import type { ExtractKinds } from "./extractor";
import type { GeneralTokenDataBinding, Token } from "./token";

export type ILexerCoreLexOptions<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
> = {
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
  rest?: string | undefined;
  actionState: ActionState;
  /**
   * Ensure the output token is the expected kind and/or text.
   *
   * If `expect.kind` is provided, actions with different kinds will be ignored.
   *
   * If `expect.text` is provided, output with different text will be rejected.
   *
   * Muted actions will still be executed and their output will not be emitted.
   * @default
   * { kind: undefined, text: undefined }
   */
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
};

export type ILexerCoreLexOutput<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> = {
  /**
   * `null` if no actions can be accepted or all muted.
   */
  token: Token<DataBindings, ErrorType> | null;
  /**
   * How many chars are digested during this lex.
   * Zero if no actions can be accepted.
   * This might be non-zero even the `token` is `null`,
   * since there might be some muted actions are accepted.
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

export type ILexerCoreTrimStartOptions<ActionState> = Pick<
  ILexerCoreLexOptions<never, ActionState>,
  "debug" | "logger" | "rest" | "start" | "actionState"
> & {
  /**
   * @default "LexerCore.trimStart"
   */
  entity?: string;
};

export type ILexerCoreTrimStartOutput<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> = Pick<
  ILexerCoreLexOutput<DataBindings, ErrorType>,
  "digested" | "rest" | "errors"
>;

export interface IReadonlyLexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  /**
   * This is used for {@link IReadonlyLexerCore.dryClone} and {@link ILexerCore.reset}.
   */
  readonly initialState: Readonly<ActionState>;
  /**
   * The current state.
   */
  get state(): Readonly<ActionState>;
  /**
   * This is used for {@link IReadonlyLexerCore.clone} and {@link ILexerCore.reset}.
   */
  readonly stateCloner: ActionStateCloner<ActionState>;
  /**
   * Clone a new lexer core with the same definitions and the initial state.
   */
  dryClone(): ILexerCore<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer core with the same definitions and the current state.
   */
  clone(): ILexerCore<DataBindings, ActionState, ErrorType>;
  /**
   * Lex with partial options.
   */
  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    // readonly lex, must set peek to true
    // so the options can't be omitted
    options: Readonly<
      Partial<ILexerCoreLexOptions<DataBindings, ActionState>> & { peek: true }
    >,
  ): ILexerCoreLexOutput<DataBindings, ErrorType>;
  /**
   * Lex with full options.
   */
  _lex(
    /**
     * The whole input string.
     */
    buffer: string,
    // readonly lex, must set peek to true
    // so the options can't be omitted
    options: Readonly<
      ILexerCoreLexOptions<DataBindings, ActionState> & { peek: true }
    >,
  ): ILexerCoreLexOutput<DataBindings, ErrorType>;
  /**
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<ExtractKinds<DataBindings>>;
}

export interface ILexerCore<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> extends IReadonlyLexerCore<DataBindings, ActionState, ErrorType> {
  /**
   * Return this as a readonly lexer core.
   */
  get readonly(): IReadonlyLexerCore<DataBindings, ActionState, ErrorType>;
  state: ActionState; // make the state mutable
  /**
   * Reset the lexer core to the initial state.
   */
  reset(): this;
  /**
   * Lex with partial options.
   */
  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    options?: Readonly<
      Partial<ILexerCoreLexOptions<DataBindings, ActionState>>
    >,
  ): ILexerCoreLexOutput<DataBindings, ErrorType>;
  /**
   * Lex with full options.
   */
  _lex(
    /**
     * The whole input string.
     */
    buffer: string,
    options: Readonly<ILexerCoreLexOptions<DataBindings, ActionState>>,
  ): ILexerCoreLexOutput<DataBindings, ErrorType>;
  /**
   * TrimStart with partial options.
   */
  trimStart(
    buffer: string,
    options?: Readonly<Partial<ILexerCoreTrimStartOptions<ActionState>>>,
  ): ILexerCoreTrimStartOutput<DataBindings, ErrorType>;
  /**
   * TrimStart with full options.
   */
  _trimStart(
    buffer: string,
    options: Readonly<ILexerCoreTrimStartOptions<ActionState>>,
  ): ILexerCoreTrimStartOutput<DataBindings, ErrorType>;
}
