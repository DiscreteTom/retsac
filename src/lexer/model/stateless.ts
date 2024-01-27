import type { Logger } from "../../logger";
import type { ReadonlyAction } from "../action";
import type { Expectation } from "./expectation";
import type { ExtractKinds } from "./extractor";
import type { ILexOutput, ITrimOutput } from "./output";
import type { GeneralTokenDataBinding, IToken } from "./token";

export type IStatelessLexerLexOptions<
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
  expect?: Readonly<Expectation<DataBindings["kind"]>>;
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

export type IStatelessLexerTrimOptions<ActionState> = Pick<
  IStatelessLexerLexOptions<never, ActionState>,
  "debug" | "logger" | "rest" | "start" | "actionState"
> & {
  /**
   * @default "LexerCore.trimStart"
   */
  entity?: string;
};

/**
 * Stateless lexer is always readonly.
 */
export interface IStatelessLexer<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  /**
   * All actions.
   */
  readonly actions: readonly ReadonlyAction<
    DataBindings,
    ActionState,
    ErrorType
  >[];
  /**
   * This is used to accelerate expected lexing.
   */
  readonly actionMap: ReadonlyMap<
    DataBindings["kind"],
    readonly ReadonlyAction<DataBindings, ActionState, ErrorType>[]
  >;
  /**
   * This is used to accelerate trimming.
   */
  readonly maybeMutedActions: readonly ReadonlyAction<
    DataBindings,
    ActionState,
    ErrorType
  >[];

  /**
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<ExtractKinds<DataBindings>>;

  lex(
    /**
     * The whole input string.
     */
    buffer: string,
    /**
     * `actionState` is required.
     */
    options: Readonly<IStatelessLexerLexOptions<DataBindings, ActionState>>,
  ): ILexOutput<IToken<DataBindings, ErrorType>>;

  trim(
    /**
     * The whole input string.
     */
    buffer: string,
    /**
     * `actionState` is required.
     */
    options: Readonly<IStatelessLexerTrimOptions<ActionState>>,
  ): Pick<
    ITrimOutput<IToken<DataBindings, ErrorType>>,
    "digested" | "errors" | "rest"
  >;
}
