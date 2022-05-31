import { Action, ActionSource } from "./action";
import { exact } from "./utils";

export type Token = {
  type: string;
  content: string; // text content
  start: number; // start position of input string
  end: number; // end position of input string
};

export type Definition = {
  type: string;
  action: Action;
};

export class Lexer {
  private defs: Definition[];
  private buffer: string;
  private offset: number; // how many chars are digested

  constructor() {
    this.defs = [];
    this.buffer = "";
    this.offset = 0;
  }

  /**
   * Define token types.
   */
  define(defs: { [type: string]: ActionSource }) {
    for (const type in defs) {
      this.defs.push({
        type,
        action: Action.from(defs[type]),
      });
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
  ignore(...r: ActionSource[]) {
    r.map((s) => this.define({ "": Action.from(s).mute() }));
    return this;
  }

  /**
   * Define a type with multiple action.
   */
  overload(defs: { [type: string]: ActionSource[] }) {
    for (const type in defs) {
      defs[type].map((action) => {
        let def: { [type: string]: ActionSource } = {};
        def[type] = action;
        this.define(def);
      });
    }
    return this;
  }

  feed(input: string) {
    this.buffer += input;
    return this;
  }

  reset() {
    this.buffer = "";
    this.offset = 0;
    return this;
  }

  /**
   * Try to retrieve a token. If nothing match, return `null`.
   */
  lex(input = ""): Token {
    this.feed(input);
    if (this.buffer.length == 0) return null;

    while (true) {
      let mute = false;
      for (const def of this.defs) {
        let res = def.action.exec(this.buffer, this.offset);
        if (res.accept) {
          this.buffer = res.buffer;
          this.offset = res.end;
          if (!res.mute) {
            return {
              type: def.type,
              content: res.content,
              start: res.start,
              end: res.end,
            };
          } else {
            // mute, re-loop all definitions
            mute = true;
            break;
          }
        }
      }
      if (!mute)
        // all definition checked, no accept
        return null;
    }
  }

  /**
   * Try to retrieve a token list.
   */
  lexAll(input = "") {
    this.feed(input);

    let result: Token[] = [];
    while (true) {
      let res = this.lex();
      if (res) result.push(res);
      else break;
    }
    return result;
  }

  /**
   * Get the rest string buffer.
   */
  getRest() {
    return this.buffer;
  }

  /**
   * Buffer not empty.
   */
  hasRest() {
    return this.buffer.length != 0;
  }

  getTokenTypes() {
    let res: Set<string> = new Set();
    this.defs.map((d) => res.add(d.type));
    return res;
  }
}
