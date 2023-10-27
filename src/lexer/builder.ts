import type { ActionSource, ActionStateCloner } from "./action";
import { Action } from "./action";
import { Lexer } from "./lexer";
import type { Definition, ILexer, TokenDataBinding } from "./model";
import { LexerCore } from "./core";

export type LexerBuildOptions = Partial<
  Pick<ILexer<never, never, never, never, never>, "logger" | "debug">
>;

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

  /**
   * Define token kinds.
   */
  // TODO: different kinds map different data?
  define<AppendKinds extends string, AppendData>(
    defs: {
      [kind in AppendKinds]:
        | ActionSource<
            AppendData | never,
            ActionState | never,
            ErrorType | never
          >
        | ActionSource<
            AppendData | never,
            ActionState | never,
            ErrorType | never
          >[];
    },
    decorator?: (
      a: Action<Data, ActionState, ErrorType>,
    ) => Action<Data, ActionState, ErrorType>,
  ): Builder<
    Kinds | AppendKinds,
    Data | AppendData,
    DataBindings | TokenDataBinding<AppendKinds, AppendData>,
    ActionState,
    ErrorType
  > {
    for (const kind in defs) {
      const raw = defs[kind] as
        | ActionSource<Data, ActionState, ErrorType>
        | ActionSource<Data, ActionState, ErrorType>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        (
          this as Builder<
            Kinds | AppendKinds,
            Data,
            DataBindings,
            ActionState,
            ErrorType
          >
        ).defs.push({
          kinds: new Set([kind]),
          action:
            decorator !== undefined
              ? decorator(Action.from(a))
              : Action.from(a),
          selector: () => kind,
        });
      });
    }
    return this as Builder<
      Kinds | AppendKinds,
      Data | AppendData,
      DataBindings | TokenDataBinding<AppendKinds, AppendData>,
      ActionState,
      ErrorType
    >;
  }

  select(
    action: ActionSource<Data, ActionState, ErrorType>,
    props: { kinds: Kinds[]; selector: () => Kinds },
  ) {
    this.defs.push({
      kinds: new Set(props.kinds),
      action: Action.from(action),
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
    return this.define({ "": actions.map((a) => Action.from(a).mute()) });
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
