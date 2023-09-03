import { Action, ActionSource } from "./action";
import { Lexer } from "./lexer";
import { Definition, ILexer } from "./model";

export type LexerBuildOptions = Partial<
  Pick<ILexer<any, any>, "logger" | "debug">
>;

/**
 * Lexer builder.
 */
// TODO: remove `''` from default `Kinds`?
export class Builder<E = string, Kinds extends string = ""> {
  private defs: Readonly<Definition<E>>[];

  constructor() {
    this.defs = [];
  }

  /**
   * Define token kinds.
   */
  define<K extends string>(defs: {
    [kind in K]: ActionSource<E> | ActionSource<E>[];
  }): Builder<E, Kinds | keyof typeof defs> {
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
  anonymous(...actions: ActionSource<E>[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource<E>[]) {
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
    return new Lexer<E, Kinds>(this.defs, options);
  }
}
