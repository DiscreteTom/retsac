import { Action, ActionSource } from "./action";
import { Lexer } from "./lexer";
import { Definition } from "./model";

/** Lexer builder. */
export class Builder {
  private defs: Definition[];

  constructor() {
    this.defs = [];
  }

  /**
   * Define token types.
   */
  define(defs: { [type: string]: ActionSource | ActionSource[] }) {
    for (const type in defs) {
      const raw = defs[type];
      (raw instanceof Array ? raw : [raw]).forEach((src) => {
        this.defs.push({
          type,
          action: Action.from(src),
        });
      });
    }
    return this;
  }

  /**
   * Define tokens with empty type.
   */
  anonymous(...actions: ActionSource[]) {
    return this.define({ "": actions });
  }

  /**
   * Define muted anonymous actions.
   */
  ignore(...actions: ActionSource[]) {
    return this.define({ "": actions.map((a) => Action.from(a).mute()) });
  }

  /**
   * Get all defined token types.
   */
  getTokenTypes() {
    return this.build().getTokenTypes();
  }

  build() {
    return new Lexer(this.defs);
  }
}
