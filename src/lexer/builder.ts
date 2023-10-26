import type { ActionSource, ActionStateCloner } from "./action";
import { Action } from "./action";
import { Lexer } from "./lexer";
import type { Definition, ILexer, TokenDataBinding } from "./model";
import { LexerCore } from "./core";

export type LexerBuildOptions = Partial<
  Pick<ILexer<unknown, unknown, string, never, never>, "logger" | "debug">
>;

/**
 * Lexer builder.
 */
export class Builder<
  Data = never,
  ErrorType = string,
  Kinds extends string = never,
  DataBindings extends TokenDataBinding<Kinds, Data> = never,
  ActionState = never,
> {
  private defs: Readonly<Definition<Data, ErrorType, Kinds, ActionState>>[];
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
  ): Builder<Data, ErrorType, Kinds, DataBindings, NewActionState> {
    const _this = this as unknown as Builder<
      Data,
      ErrorType,
      Kinds,
      DataBindings,
      NewActionState
    >;
    _this.initialState = state;
    _this.stateCloner = cloner ?? ((state) => structuredClone(state));
    return _this;
  }

  /**
   * Define token kinds.
   */
  define<Append extends string>(
    defs: {
      [kind in Append]:
        | ActionSource<Data, ErrorType, ActionState>
        | ActionSource<Data, ErrorType, ActionState>[];
    },
    decorator?: (
      a: Action<Data, ErrorType, ActionState>,
    ) => Action<Data, ErrorType, ActionState>,
  ): Builder<Data, ErrorType, Kinds | Append, DataBindings, ActionState> {
    for (const kind in defs) {
      const raw = defs[kind] as
        | ActionSource<Data, ErrorType, ActionState>
        | ActionSource<Data, ErrorType, ActionState>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        (
          this as Builder<
            Data,
            ErrorType,
            Kinds | Append,
            DataBindings,
            ActionState
          >
        ).defs.push({
          kind,
          action:
            decorator !== undefined
              ? decorator(Action.from(a))
              : Action.from(a),
        });
      });
    }
    return this;
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous(...actions: ActionSource<Data, ErrorType, ActionState>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<Data, ErrorType, ActionState>[]) {
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
  ): Lexer<Data, ErrorType, Kinds, DataBindings, ActionState> {
    return new Lexer<Data, ErrorType, Kinds, DataBindings, ActionState>(
      new LexerCore(this.defs, this.initialState, this.stateCloner),
      options,
    );
  }
}
