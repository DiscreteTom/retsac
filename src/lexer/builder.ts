import type { ActionStateCloner } from "./action";
import { Action, ActionBuilder } from "./action";
import { Lexer } from "./lexer";
import type {
  Definition,
  ExtractData,
  ExtractDefinition,
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
} from "./model";
import { LexerCore } from "./core";
import type { SelectedAction } from "./action";

export type LexerBuildOptions = Partial<
  Pick<ILexer<never, never, never>, "logger" | "debug">
>;

export type ActionSource<Data, ActionState, ErrorType> =
  | RegExp
  | Action<Data, ActionState, ErrorType>
  | ((
      a: ActionBuilder<ActionState, ErrorType>,
    ) => Action<Data, ActionState, ErrorType>);

/**
 * Lexer builder.
 */
export class Builder<
  DataBindings extends GeneralTokenDataBinding = never,
  ActionState = never,
  ErrorType = never,
> {
  private defs: Readonly<
    ExtractDefinition<DataBindings, ActionState, ErrorType>
  >[];
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
  ): Builder<DataBindings, NewActionState, ErrorType> {
    const _this = this as unknown as Builder<
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
    return this as unknown as Builder<DataBindings, ActionState, NewError>;
  }

  static buildAction<Data, ActionState, ErrorType>(
    src: ActionSource<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return src instanceof RegExp || src instanceof Action
      ? Action.from(src)
      : src(new ActionBuilder<ActionState, ErrorType>());
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
  define<AppendKinds extends string, AppendData = never>(defs: {
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
        _this.defs.push({
          kinds: new Set([kind as AppendKinds]),
          action: Builder.buildAction(a),
          selector: () => kind as AppendKinds,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any); // TODO: fix type
      });
    }
    return _this;
  }

  /**
   * Define an action which can yield multiple kinds.
   * @example
   * builder.branch(a => a.from(...).kinds(...).select(...))
   */
  branch<AppendKinds extends string, AppendData>(
    builder: (
      a: ActionBuilder<ActionState, ErrorType>,
    ) => SelectedAction<AppendKinds, AppendData, ActionState, ErrorType>,
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
    const selected = builder(new ActionBuilder<ActionState, ErrorType>());
    _this.defs.push({
      kinds: new Set(selected.kinds),
      action: selected.action,
      selector: selected.selector,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any); // TODO: fix type
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
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<ExtractKinds<DataBindings>> {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(
    options?: LexerBuildOptions,
  ): Lexer<DataBindings, ActionState, ErrorType> {
    const defMap = new Map<
      ExtractKinds<DataBindings>,
      Readonly<
        Definition<
          ExtractKinds<DataBindings>,
          ExtractData<DataBindings>,
          ActionState,
          ErrorType
        >
      >[]
    >();
    this.defs.forEach((def) => {
      def.kinds.forEach((kind) => {
        const arr = defMap.get(kind);
        if (arr !== undefined) arr.push(def);
        else defMap.set(kind, [def]);
      });
    });
    return new Lexer<DataBindings, ActionState, ErrorType>(
      new LexerCore(this.defs, defMap, this.initialState, this.stateCloner),
      options,
    );
  }
}
