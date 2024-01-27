import type { ActionStateCloner, ReadonlyAction } from "./action";
import { Action, ActionBuilder, defaultActionStateCloner } from "./action";
import { Lexer } from "./lexer";
import type { GeneralTokenDataBinding, ILexer } from "./model";
import { StatelessLexer } from "./stateless";
import type { Expand } from "../helper";

export type LexerBuilderBuildOptions = Partial<
  Pick<ILexer<never, never, never>, "logger" | "debug">
>;

export type IntoNoKindAction<Data, ActionState, ErrorType> =
  | RegExp
  | Action<{ kind: never; data: Data }, ActionState, ErrorType>
  | ((
      a: ActionBuilder<ActionState, ErrorType>,
    ) => Action<{ kind: never; data: Data }, ActionState, ErrorType>);

export type ExtractNewDataBindings<
  Mapper extends Record<
    string,
    | IntoNoKindAction<unknown, ActionState, ErrorType>
    | IntoNoKindAction<unknown, ActionState, ErrorType>[]
  >,
  ActionState,
  ErrorType,
> = {
  [K in Extract<keyof Mapper, string>]: {
    kind: K;
    data: Mapper[K] extends Array<infer T>
      ? ExtractBindingData<T, ActionState, ErrorType>
      : ExtractBindingData<Mapper[K], ActionState, ErrorType>;
  };
}[Extract<keyof Mapper, string>];

export type ExtractBindingData<T, ActionState, ErrorType> = T extends RegExp
  ? undefined
  : T extends Action<infer Binding, ActionState, ErrorType>
  ? Binding["data"]
  : T extends (
      a: ActionBuilder<ActionState, ErrorType>,
    ) => Action<infer Binding, ActionState, ErrorType>
  ? Binding["data"]
  : undefined;

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
  private readonly actions: ReadonlyAction<
    DataBindings,
    ActionState,
    ErrorType
  >[];
  private defaultActionState: Readonly<ActionState>;
  private actionStateCloner: ActionStateCloner<ActionState>;

  constructor() {
    this.actions = [];
    this.actionStateCloner = defaultActionStateCloner;
  }

  /**
   * Set initial action state.
   * @example
   * // use structuredClone as default cloner
   * builder.state({ count: 0 })
   * // custom cloner
   * builder.state({ count: 0 }, state => ({ ...state }))
   */
  state<
    // make sure NewActionState is a sub type (superset) of ActionState
    NewActionState extends [ActionState] extends [never] // why array? see https://github.com/microsoft/TypeScript/issues/31751 [[type constraints with array]]
      ? unknown // ActionState is never, so NewActionState can be anything
      : ActionState, // ActionState is not never, so NewActionState must be a child type of ActionState
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
    _this.defaultActionState = state;
    _this.actionStateCloner = cloner ?? defaultActionStateCloner;
    return _this;
  }

  /**
   * Set error type.
   * @example
   * // provide type explicitly
   * builder.error<number>();
   * // infer type from error value
   * builder.error(0);
   */
  error<
    // make sure NewError is a super type (subset) of ErrorType
    NewError extends [ErrorType] extends [NewError] // why array? see [[@type constraints with array]]
      ? unknown // NewError is a super type of ErrorType, so it can be anything
      : never, // NewError is not a super type of ErrorType, reject
  >(_?: NewError): Builder<DataBindings, ActionState, NewError> {
    return this as unknown as Builder<DataBindings, ActionState, NewError>;
  }

  static buildAction<Data, ActionState, ErrorType>(
    src: IntoNoKindAction<Data, ActionState, ErrorType>,
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
   * builder.append(a => a.from(...).kinds(...).select(...))
   */
  append<
    Builders extends ((
      a: ActionBuilder<ActionState, ErrorType>,
    ) => Action<GeneralTokenDataBinding, ActionState, ErrorType>)[],
  >(
    ...builders: Builders
  ): Builder<
    | DataBindings
    | (ReturnType<Builders[number]> extends Action<
        infer DataBindings, // TODO: make sure kind is not `never`
        infer _,
        infer __
      >
        ? DataBindings
        : never),
    ActionState,
    ErrorType
  > {
    builders.forEach((build) =>
      this.actions.push(
        build(
          new ActionBuilder<ActionState, ErrorType>(),
        ) as unknown as ReadonlyAction<DataBindings, ActionState, ErrorType>,
      ),
    );

    return this as unknown as Builder<
      DataBindings | ReturnType<Builders[number]> extends Action<
        infer DataBindings,
        infer _,
        infer __
      >
        ? DataBindings
        : never,
      ActionState,
      ErrorType
    >;
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
  define<
    Mapper extends Record<
      string,
      | IntoNoKindAction<unknown, ActionState, ErrorType>
      | IntoNoKindAction<unknown, ActionState, ErrorType>[]
    >,
  >(
    mapper: Mapper,
  ): Builder<
    | DataBindings
    | Expand<ExtractNewDataBindings<Mapper, ActionState, ErrorType>>,
    ActionState,
    ErrorType
  > {
    for (const kind in mapper) {
      const raw = mapper[kind] as
        | IntoNoKindAction<unknown, ActionState, ErrorType>
        | IntoNoKindAction<unknown, ActionState, ErrorType>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        this.actions.push(
          Builder.buildAction(a).bind(kind) as unknown as ReadonlyAction<
            DataBindings,
            ActionState,
            ErrorType
          >,
        );
      });
    }

    return this as Builder<
      | DataBindings
      | Expand<ExtractNewDataBindings<Mapper, ActionState, ErrorType>>,
      ActionState,
      ErrorType
    >;
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous<AppendData = undefined>(
    ...actions: IntoNoKindAction<AppendData, ActionState, ErrorType>[]
  ): Builder<
    DataBindings | { kind: ""; data: AppendData },
    ActionState,
    ErrorType
  > {
    return this.define({
      "": actions.map((a) => Builder.buildAction(a)),
    }) as Builder<
      DataBindings | { kind: ""; data: AppendData },
      ActionState,
      ErrorType
    >;
  }

  /**
   * Define muted anonymous actions.
   */
  ignore<AppendData = undefined>(
    // though muted actions won't emit token,
    // there might be muted error tokens which will be recorded
    // so we still need to record the data binding
    ...actions: IntoNoKindAction<AppendData, ActionState, ErrorType>[]
  ): Builder<
    DataBindings | { kind: ""; data: AppendData },
    ActionState,
    ErrorType
  > {
    return this.define({
      "": actions.map((a) => Builder.buildAction(a).mute()),
    }) as Builder<DataBindings, ActionState, ErrorType>;
  }

  buildStateless() {
    return new StatelessLexer(this.actions);
  }

  build(
    buffer?: string,
    options?: LexerBuilderBuildOptions,
  ): Lexer<DataBindings, ActionState, ErrorType> {
    return new Lexer<DataBindings, ActionState, ErrorType>(
      this.buildStateless(),
      {
        buffer: buffer ?? "",
        defaultActionState: this.defaultActionState,
        actionStateCloner: this.actionStateCloner,
        ...options,
      },
    );
  }
}
