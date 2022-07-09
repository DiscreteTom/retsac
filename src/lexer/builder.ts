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
      let raw = defs[type];
      let actionSources = raw instanceof Array ? raw : [raw];

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
   * Define anonymous tokens.
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

  getTokenTypes() {
    let res: Set<string> = new Set();
    this.defs.map((d) => res.add(d.type));
    return res;
  }

  build() {
    return new Lexer(this.defs);
  }
}
