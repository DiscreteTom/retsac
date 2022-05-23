import { Action, ActionSource } from "./action";

export type Token = {
  type: string;
  content: string; // text content
};

export type Definition = {
  type: string;
  action: Action;
};

export class Lexer {
  private defs: Definition[];
  private buffer: string;

  constructor() {
    this.defs = [];
    this.buffer = "";
  }

  define(defs: { [type: string]: ActionSource }) {
    for (const type in defs) {
      this.defs.push({
        type,
        action: Action.from(defs[type]),
      });
    }
    return this;
  }

  static define(defs: { [type: string]: ActionSource }) {
    return new Lexer().define(defs);
  }

  /**
   * Define muted action.
   */
  ignore(...r: ActionSource[]) {
    r.map((s) => this.define({ "": Action.from(s).mute() }));
    return this;
  }

  static ignore(...r: ActionSource[]) {
    return new Lexer().ignore(...r);
  }

  feed(input: string) {
    this.buffer += input;
    return this;
  }

  reset() {
    this.buffer = "";
    return this;
  }

  /**
   * Try to retrieve a token. If nothing match, return `null`.
   */
  lex(): Token {
    if (this.buffer.length == 0) return null;

    while (true) {
      let mute = false;
      for (const def of this.defs) {
        let res = def.action.exec(this.buffer);
        if (res.accept) {
          this.buffer = res.buffer;
          if (!res.mute) {
            return { type: def.type, content: res.content };
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
   * Apply function until scan ends.
   */
  apply<T>(f: (t: Token) => T) {
    let result: T[] = [];
    while (true) {
      let res = this.lex();
      if (res) {
        result.push(f(res));
      } else break;
    }
    return result;
  }

  /**
   * Try to retrieve a token list.
   */
  lexAll() {
    return this.apply((t) => t);
  }

  /**
   * Get the rest buffer.
   */
  getRest() {
    return this.buffer;
  }

  /**
   * Whether buffer length is 0.
   */
  isDone() {
    return this.getRest().length == 0;
  }

  getTokenTypes() {
    let res: Set<string> = new Set();
    this.defs.map((d) => res.add(d.type));
    return res;
  }
}
