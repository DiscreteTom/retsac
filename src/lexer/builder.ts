import type { ActionSource } from "./action";
import { Action } from "./action";
import { Lexer } from "./lexer";
import type { ActionStateCloner, Definition, ILexer } from "./model";
import { LexerCore } from "./stateless";

export type LexerBuildOptions = Partial<
  Pick<ILexer<unknown, string, never>, "logger" | "debug">
>;

/**
 * Lexer builder.
 */
export class Builder<
  ErrorType = string,
  Kinds extends string = never,
  ActionState = never,
> {
  private defs: Readonly<Definition<ErrorType, Kinds, ActionState>>[];
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
  ): Builder<ErrorType, Kinds, NewActionState> {
    const _this = this as unknown as Builder<ErrorType, Kinds, NewActionState>;
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
        | ActionSource<ErrorType, ActionState>
        | ActionSource<ErrorType, ActionState>[];
    },
    decorator?: (
      a: Action<ErrorType, ActionState>,
    ) => Action<ErrorType, ActionState>,
  ): Builder<ErrorType, Kinds | Append, ActionState> {
    for (const kind in defs) {
      const raw = defs[kind] as
        | ActionSource<ErrorType, ActionState>
        | ActionSource<ErrorType, ActionState>[];

      // IMPORTANT: DON'T use Action.reduce to merge multi actions into one
      // because when we lex with expectation, we should evaluate actions one by one

      (raw instanceof Array ? raw : [raw]).forEach((a) => {
        (this as Builder<ErrorType, Kinds | Append, ActionState>).defs.push({
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
  anonymous(...actions: ActionSource<ErrorType, ActionState>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<ErrorType, ActionState>[]) {
    return this.define({ "": actions.map((a) => Action.from(a).mute()) });
  }

  /**
   * Get all defined token kinds.
   */
  getTokenKinds(): Set<Kinds> {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(options?: LexerBuildOptions): Lexer<ErrorType, Kinds, ActionState> {
    return new Lexer<ErrorType, Kinds, ActionState>(
      new LexerCore(this.defs, this.initialState, this.stateCloner),
      options,
    );
  }
}
