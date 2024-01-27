import type { Logger } from "../../logger";
import type { ActionStateCloner } from "../action";
import type { IStatelessLexer } from "./stateless";
import type { Expectation } from "./expectation";
import type {
  ILexAllOutput,
  ILexOutput,
  IPeekOutput,
  ITrimOutput,
} from "./output";
import type { IReadonlyLexerState } from "./state";
import type { GeneralTokenDataBinding, Token } from "./token";

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
> {
  readonly stateless: IStatelessLexer<DataBindings, ActionState, ErrorType>;
  readonly state: IReadonlyLexerState<DataBindings, ErrorType>;
  readonly actionState: Readonly<ActionState>;
  readonly defaultActionState: Readonly<ActionState>;
  readonly actionStateCloner: ActionStateCloner<ActionState>;
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
   * Clone a new lexer with a new buffer, the same definitions and the initial state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  dryClone(
    buffer: string,
    options?: ILexerCloneOptions,
  ): ILexer<DataBindings, ActionState, ErrorType>;
  /**
   * Clone a new lexer with the same definitions and current state.
   * If `options.debug/logger` is omitted, the new lexer will inherit from the original one.
   */
  clone(
    options?: ILexerCloneOptions,
  ): ILexer<DataBindings, ActionState, ErrorType>;
  /**
   * Peek won't change the lexer's state.
   * It will clone the current action state and return it in the peek output.
   */
  peek(
    expectation?: Expectation<DataBindings["kind"]>,
  ): IPeekOutput<Token<DataBindings, ErrorType>, ActionState>;
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
  actionState: ActionState; // make mutable
  set debug(value: boolean);
  set logger(value: Logger);
  /**
   * Take at most `n` chars from the rest of input and update state.
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
    actionState?: ActionState,
  ): this;
  lex(
    expectation?: Expectation<DataBindings["kind"]>,
  ): ILexOutput<Token<DataBindings, ErrorType>>;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(): ILexAllOutput<Token<DataBindings, ErrorType>>;
  /**
   * Remove ignored chars from the start of the rest of buffer.
   */
  trim(): ITrimOutput<
    Token<DataBindings, ErrorType>,
    ILexer<DataBindings, ActionState, ErrorType>
  >;
}
