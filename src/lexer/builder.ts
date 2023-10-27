import type { ActionStateCloner } from "./action";
import { Action, ActionBuilder } from "./action";
import { Lexer } from "./lexer";
import type { Definition, ILexer, TokenDataBinding } from "./model";
import { LexerCore } from "./core";

export type LexerBuildOptions = Partial<
  Pick<ILexer<never, never, never, never, never>, "logger" | "debug">
>;

export type ActionSource<Data, ActionState, ErrorType> =
  | RegExp
  | Action<Data, ActionState, ErrorType>
  | ((
      a: ActionBuilder<never, ActionState, ErrorType>,
    ) => Action<Data, ActionState, ErrorType>);

/**
 * Lexer builder.
 */
export class Builder<
  Kinds extends string = never,
  Data = never,
  DataBindings extends TokenDataBinding<Kinds, Data> = never,
  ActionState = never,
  ErrorType = string,
> {
  private defs: Readonly<Definition<Kinds, Data, ActionState, ErrorType>>[];
  private initialState: Readonly<ActionState>;
  private stateCloner: ActionStateCloner<ActionState>;

  constructor() {
    this.defs = [];
    this.stateCloner = (state) => structuredClone(state);
  }

  /**
   * Set initial action state.
   */
  useState<NewActionState>(
    state: NewActionState,
    cloner?: ActionStateCloner<NewActionState>,
  ): Builder<Kinds, Data, DataBindings, NewActionState, ErrorType> {
    const _this = this as unknown as Builder<
      Kinds,
      Data,
      DataBindings,
      NewActionState,
      ErrorType
    >;
    _this.initialState = state;
    _this.stateCloner = cloner ?? ((state) => structuredClone(state));
    return _this;
  }

  /**
   * Set error type.
   * @example
   * // provide type explicitly
   * builder.useError<number>();
   * // infer type from error value
   * builder.useError(0);
   */
  useError<NewError>(_?: NewError) {
    return this as unknown as Builder<
      Kinds,
      Data,
      DataBindings,
      ActionState,
      NewError
    >;
  }

  static buildAction<Data, ActionState, ErrorType>(
    src: ActionSource<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return src instanceof RegExp || src instanceof Action
      ? Action.from(src)
      : src(new ActionBuilder<never, ActionState, ErrorType>());
  }

  /**
   * Define token kinds.
   * @example
   * builder.define({
   *   number: /\d+/, // with regex
   *   another: Action.from(/\d+/), // with action
   *   chain: a => a.from(/\d+/).data(() => 123), // with action builder
   * })
   */
  // TODO: different kinds map different data?
  define<AppendKinds extends string, AppendData>(defs: {
    [kind in AppendKinds]:
      | ActionSource<AppendData, ActionState, ErrorType>
      | ActionSource<AppendData, ActionState, ErrorType>[];
  }): Builder<
    Kinds | AppendKinds,
    Data | AppendData,
    DataBindings | { kind: AppendKinds; data: AppendData },
    ActionState,
    ErrorType
  > {
    const _this = this as Builder<
      Kinds | AppendKinds,
      Data | AppendData,
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
        _this.defs.push({
          kinds: new Set([kind]),
          action: Builder.buildAction(a) as Action<
            Data | AppendData,
            ActionState,
            ErrorType
          >,
          selector: () => kind,
        });
      });
    }
    return _this;
  }

  // TODO: fix generic type
  select(
    action: ActionSource<Data, ActionState, ErrorType>,
    props: { kinds: Kinds[]; selector: () => Kinds },
  ) {
    this.defs.push({
      kinds: new Set(props.kinds),
      action: Builder.buildAction(action),
      selector: props.selector,
    });
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous(...actions: ActionSource<Data, ActionState, ErrorType>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<Data, ActionState, ErrorType>[]) {
    return this.define({
      "": actions.map((a) => Builder.buildAction(a).mute()),
    });
  }

  /**
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<Kinds> {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(
    options?: LexerBuildOptions,
  ): Lexer<Kinds, Data, DataBindings, ActionState, ErrorType> {
    return new Lexer<Kinds, Data, DataBindings, ActionState, ErrorType>(
      new LexerCore(this.defs, this.initialState, this.stateCloner),
      options,
    );
  }
}
