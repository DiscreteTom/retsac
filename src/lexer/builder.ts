import { Action, ActionSource } from "./action";
import { Lexer } from "./lexer";
import { Definition, ILexer } from "./model";

export type LexerBuildOptions = Partial<
  Pick<ILexer<any, any>, "logger" | "debug">
>;

/**
 * Lexer builder.
 */
export class Builder<ErrorType = string, Kinds extends string = never> {
  private defs: Readonly<Definition<ErrorType>>[];

  constructor() {
    this.defs = [];
  }

  /**
   * Define token kinds.
   */
  define<Append extends string>(defs: {
    [kind in Append]: ActionSource<ErrorType> | ActionSource<ErrorType>[];
  }): Builder<ErrorType, Kinds | Append> {
    for (const kind in defs) {
      const raw = defs[kind];
      this.defs.push({
        kind,
        action:
          raw instanceof Array
            ? // use `reduce` to merge actions to optimize performance
              Action.reduce(...raw)
            : Action.from(raw),
      });
    }
    return this;
  }

  /**
   * Define tokens with empty kind.
   */
  anonymous(...actions: ActionSource<ErrorType>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<ErrorType>[]) {
    return this.define({ "": actions.map((a) => Action.from(a).mute()) });
  }

  /**
   * Get all defined token kinds.
   */
  getTokenKinds() {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenKinds();
  }

  build(options?: LexerBuildOptions) {
    return new Lexer<ErrorType, Kinds>(this.defs, options);
  }
}
