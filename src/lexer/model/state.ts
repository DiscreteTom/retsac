import type { LazyString } from "../../helper";
import type { GeneralTokenDataBinding } from "./token";

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
   * `true` if there is no muted token at the beginning of the rest of input.
   */
  readonly trimmed: boolean;
  readonly rest: LazyString;

  /**
   * Readonly version of this state.
   */
  get readonly(): IReadonlyLexerState<DataBindings, ErrorType>;

  clone(): ILexerState<DataBindings, ErrorType>;

  /**
   * Take `n` chars from the rest of the input and update related states.
   * The caller should ensure the `n` is greater or equal to 0.
   *
   * If the caller can get the rest unintentionally, it can be passed to the `rest` parameter.
   */
  digest(n: number, rest: string | undefined): void;

  /**
   * Set `trimmed` to `true`.
   */
  trim(n: number, rest: string | undefined): void;

  /**
   * Return `true` if there is still some chars in the rest of input.
   * This will NOT calculate the rest of input.
   */
  hasRest(): boolean;
}

export type IReadonlyLexerState<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> = Pick<
  ILexerState<DataBindings, ErrorType>,
  "buffer" | "digested" | "trimmed" | "rest" | "clone" | "hasRest"
>;
