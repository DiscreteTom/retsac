export type Token = {
  type: string;
  content: string; // text content
};

type ActionOutput =
  | { accept: false }
  | {
      accept: true; // return token if not mute
      mute: boolean; // don't return token, continue loop
      buffer: string; // new buffer value
      content: string; // token content
    };

type ActionExec = (buffer: string) => ActionOutput;
type SimpleActionExec = (buffer: string) => number; // only return how many chars are accepted

export class Action {
  readonly exec: ActionExec;

  constructor(exec: ActionExec) {
    this.exec = exec;
  }

  static simple(f: SimpleActionExec) {
    return new Action((buffer) => {
      let n = f(buffer);
      if (n > 0) {
        return {
          accept: true,
          mute: false,
          buffer: buffer.slice(n),
          content: buffer.slice(0, n),
        };
      } else {
        return { accept: false };
      }
    });
  }

  mute(enable = true) {
    return new Action((buffer) => {
      let output = this.exec(buffer);
      if (output.accept) {
        output.mute = enable;
      }
      return output;
    });
  }
}

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

  define(type: string, pattern: RegExp | Action | SimpleActionExec) {
    this.defs.push({
      type,
      action:
        pattern instanceof RegExp
          ? Lexer.RegExp2Action(pattern)
          : pattern instanceof Action
          ? pattern
          : Action.simple(pattern),
    });
    return this;
  }

  static define(defs: { [type: string]: RegExp | Action | SimpleActionExec }) {
    let lexer = new Lexer();
    for (const name in defs) {
      lexer.define(name, defs[name]);
    }
    return lexer;
  }

  static RegExp2Action(r: RegExp) {
    return Action.simple((buffer) => {
      let res = r.exec(buffer);
      if (res && res.index != -1) return res.index + res[0].length;
      return 0;
    });
  }

  ignore(r: RegExp, type = "ignore") {
    return this.define(type, Lexer.RegExp2Action(r).mute(true));
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
}
