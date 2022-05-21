export type Token = {
  type: string;
  content: string;
};

export class Lexer {
  private defs: { type: string; pattern: RegExp }[];
  private buffer: string;

  constructor() {
    this.defs = [];
    this.buffer = "";
  }

  define(type: string, pattern: RegExp) {
    this.defs.push({ type, pattern });
    return this;
  }

  static define(defs: { [type: string]: RegExp }) {
    let lexer = new Lexer();
    for (const name in defs) {
      lexer.define(name, defs[name]);
    }
    return lexer;
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
    for (const def of this.defs) {
      let res = def.pattern.exec(this.buffer);
      if (res && res.index != -1) {
        this.buffer = this.buffer.slice(res.index + res[0].length);
        return { type: def.type, content: res[0] };
      }
    }
    return null;
  }
}
