export type Token = {
  type: string;
  content: string;
};

export type Action = (buffer: string) =>
  | { accept: false }
  | {
      accept: true; // return token if not mute
      mute: boolean; // if accept, don't return token, continue loop
      buffer: string; // new buffer value if accept
      content: string; // token content if accept
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

  define(type: string, pattern: RegExp | Action) {
    this.defs.push({
      type,
      action:
        pattern instanceof RegExp
          ? (buffer) => {
              let res = pattern.exec(buffer);
              if (res && res.index != -1) {
                return {
                  accept: true,
                  mute: false,
                  buffer: buffer.slice(res.index + res[0].length),
                  content: res[0],
                };
              }
              return { accept: false };
            }
          : pattern,
    });
    return this;
  }

  static define(defs: { [type: string]: RegExp | Action }) {
    let lexer = new Lexer();
    for (const name in defs) {
      lexer.define(name, defs[name]);
    }
    return lexer;
  }

  ignore(r: RegExp, type = "ignore") {
    return this.define(type, (buffer) => {
      let res = r.exec(buffer);
      if (res && res.index != -1) {
        return {
          accept: true,
          mute: true,
          buffer: buffer.slice(res.index + res[0].length),
          content: res[0],
        };
      }
      return { accept: false };
    });
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
    while (true) {
      let mute = false;
      for (const def of this.defs) {
        let res = def.action(this.buffer);
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
}
