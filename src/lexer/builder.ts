import { Logger } from "../model";
import { Action, ActionSource } from "./action";
import { Lexer } from "./lexer";
import { Definition } from "./model";

export type LexerBuildOptions = {
  debug?: boolean;
  logger?: Logger;
};

/** Lexer builder. */
export class Builder<E> {
  private defs: Readonly<Definition<E>>[];

  constructor() {
    this.defs = [];
  }

  /**
   * Define token types.
   */
  define(defs: { [type: string]: ActionSource<E> | ActionSource<E>[] }) {
    for (const type in defs) {
      const raw = defs[type];
      this.defs.push({
        type,
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
   * Define tokens with empty type.
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
   * Get all defined token types.
   */
  getTokenTypes() {
    // `this.build` is lightweight, so we don't cache the result
    return this.build().getTokenTypes();
  }

  build(options?: LexerBuildOptions) {
    return new Lexer(this.defs, options);
  }
}
