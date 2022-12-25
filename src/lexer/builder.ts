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
      const actionSources = raw instanceof Array ? raw : [raw];

      for (const src of actionSources) {
        this.defs.push({
          type,
          action: Action.from(src),
        });
      }
    }
    return this;
  }

  /**
   * Define tokens with empty type.
   */
  anonymous(...actions: ActionSource[]) {
    actions.map((a) => this.define({ "": a }));
    return this;
  }

  /**
   * Define muted anonymous action.
   */
  ignore(...actions: ActionSource[]) {
    this.anonymous(...actions.map((a) => Action.from(a).mute()));
    return this;
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
