import { Action, ActionSource } from "./action";
import { Lexer } from "./lexer";
import { Definition, LexerBuildOptions } from "./model";

/** Lexer builder. */
export class Builder<E> {
  private defs: Definition<E>[];

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
        action: raw instanceof Array ? Action.reduce(...raw) : Action.from(raw),
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
    return this.build().getTokenTypes();
  }

  build(options?: LexerBuildOptions) {
    return new Lexer(this.defs, options);
  }
}
