import type { ActionStateCloner, ReadonlyAction } from "./action";
import { Action, ActionBuilder, defaultActionStateCloner } from "./action";
import { Lexer } from "./lexer";
import type { ExtractKinds, GeneralTokenDataBinding, ILexer } from "./model";
import { LexerCore } from "./core";

export type LexerBuildOptions = Partial<
  Pick<ILexer<never, never, never>, "logger" | "debug">
>;

// TODO: rename
export type ActionSource<Data, ActionState, ErrorType> =
  | RegExp
  | Action<{ kind: never; data: Data }, ActionState, ErrorType>
  | ((
      a: ActionBuilder<ActionState, ErrorType>,
    ) => Action<{ kind: never; data: Data }, ActionState, ErrorType>);

/**
 * Lexer builder.
 * @example
 * const lexer = new Lexer.Builder()
 *   .error<string>() // set error type
 *   .state({ count: 0 }) // set action state
 *   .define(...) // define token kinds and actions
 *   .anonymous(...) // define actions with no kinds
 *   .ignore(...) // define muted anonymous actions
 *   .build(); // build lexer
 */
export class Builder<
  DataBindings extends GeneralTokenDataBinding = never,
  ActionState = never,
  ErrorType = never,
> {
  // TODO: rename
  private defs: ReadonlyAction<DataBindings, ActionState, ErrorType>[];
  private initialState: Readonly<ActionState>;
  private stateCloner: ActionStateCloner<ActionState>;

  constructor() {
    this.defs = [];
    this.stateCloner = defaultActionStateCloner;
  }

  /**
   * Set initial action state.
   *
   * This function can only be called once and must be called before defining any action.
   * @example
   * // use structuredClone as default cloner
   * builder.state({ count: 0 })
   * // custom cloner
   * builder.state({ count: 0 }, state => ({ ...state }))
   */
  state<
    // make sure this function can only be called once
    // and must be called before defining any action
    NewActionState extends [DataBindings] extends [never]
      ? [ActionState] extends [never] // why array? see https://github.com/microsoft/TypeScript/issues/31751
        ? unknown // NewActionState can be any type
        : never // ActionState already set, prevent modification
      : never, // prevent setting ActionState after DataBindings is defined
  >(
    state: NewActionState,
    /**
     * @default defaultActionStateCloner
     */
    cloner?: ActionStateCloner<NewActionState>,
  ): Builder<DataBindings, NewActionState, ErrorType> {
    const _this = this as unknown as Builder<
      DataBindings,
      NewActionState,
      ErrorType
    >;
    _this.initialState = state;
    _this.stateCloner = cloner ?? defaultActionStateCloner;
    return _this;
  }

  /**
   * Set error type.
   *
   * This function can only be called once and must be called before defining any action.
   * @example
   * // provide type explicitly
   * builder.error<number>();
   * // infer type from error value
   * builder.error(0);
   */
  error<
    // make sure this function can only be called once
    // and must be called before defining any action
    NewError extends [DataBindings] extends [never]
      ? [ErrorType] extends [never]
        ? unknown // NewError can be any type
        : never // ErrorType already set, prevent modification
      : never, // prevent setting ErrorType after DataBindings is defined
  >(_?: NewError) {
    return this as unknown as Builder<DataBindings, ActionState, NewError>;
  }

  static buildAction<Data, ActionState, ErrorType>(
    src: ActionSource<Data, ActionState, ErrorType>,
  ): Action<{ kind: never; data: Data }, ActionState, ErrorType> {
    return src instanceof RegExp || src instanceof Action
      ? Action.from(src)
      : src(new ActionBuilder<ActionState, ErrorType>());
  }

  /**
   * Define actions with kinds set.
   *
   * For most cases you should use {@link Builder.define} instead.
   * @example
   * // action with single kind
   * builder.append(a => a.from(...).bind('kind'))
   * // action with multiple kinds
   * builder.append(a => a.from(...).kinds(...).map(...))
   */
  append<AppendKinds extends string, AppendData>(
    ...builder: ((a: ActionBuilder<ActionState, ErrorType>) => Action<
      // TODO: prevent AppendKinds to be never?
      // but we accept builder as a list, if one of the builders is never, we can't detect it
      { kind: AppendKinds; data: AppendData },
      ActionState,
      ErrorType
    >)[]
  ): Builder<
    DataBindings | { kind: AppendKinds; data: AppendData },
    ActionState,
    ErrorType
  > {
    const _this = this as unknown as Builder<
      DataBindings | { kind: AppendKinds; data: AppendData },
      ActionState,
      ErrorType
    >;
    builder.forEach((build) =>
      _this.defs.push(build(new ActionBuilder<ActionState, ErrorType>())),
    );
    return _this;
  }

  /**
   * Define actions with no kinds set.
   * @example
   * builder.define({
   *   number: /\d+/, // with regex
   *   another: Action.from(/\d+/), // with action
   *   chain: a => a.from(/\d+/).data(() => 123), // with action builder
   * })
   */
  // TODO: different kinds map different data?
  define<AppendKinds extends string, AppendData = undefined>(defs: {
    [kind in AppendKinds]:
      | ActionSource<AppendData, ActionState, ErrorType>
      | ActionSource<AppendData, ActionState, ErrorType>[];
  }): Builder<
    DataBindings | { kind: AppendKinds; data: AppendData },
    ActionState,
    ErrorType
  > {
    const _this = this as Builder<
      DataBindings | { kind: AppendKinds; data: AppendData },
      ActionState,
      ErrorType
    >;
    for (const kind in defs) {
      const raw = defs[kind] as
        | ActionSource<AppendData, ActionState, ErrorType>
        | ActionSource<AppendData, ActionState, ErrorType>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        _this.defs.push(Builder.buildAction(a).bind(kind));
      });
    }
    return _this;
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous<AppendData>(
    ...actions: ActionSource<AppendData, ActionState, ErrorType>[]
  ): Builder<
    DataBindings | { kind: ""; data: AppendData },
    ActionState,
    ErrorType
  > {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore<AppendData>(
    ...actions: ActionSource<AppendData, ActionState, ErrorType>[]
  ): Builder<
    DataBindings | { kind: ""; data: AppendData },
    ActionState,
    ErrorType
  > {
    return this.define({
      "": actions.map((a) => Builder.buildAction(a).mute()),
    });
  }

  /**
   * Get all defined token kinds. This will build the lexer.
   * @alias {@link Lexer.getTokenKinds}
   */
  getTokenKinds(): Set<ExtractKinds<DataBindings>> {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(
    options?: LexerBuildOptions,
  ): Lexer<DataBindings, ActionState, ErrorType> {
    return new Lexer<DataBindings, ActionState, ErrorType>(
      new LexerCore(this.defs, this.initialState, this.stateCloner),
      options,
    );
  }
}
