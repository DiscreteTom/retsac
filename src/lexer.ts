export type Token = {
  type: string;
  content: string; // text content
};

export type ActionOutput =
  | { accept: false }
  | {
      accept: true; // return token if not mute
      mute: boolean; // don't return token, continue loop
      buffer: string; // new buffer value
      content: string; // token content
    };

export type ActionExec = (buffer: string) => ActionOutput;
export type SimpleActionExec = (buffer: string) => number; // only return how many chars are accepted
export type ActionSource = RegExp | Action | SimpleActionExec;

export class Action {
  readonly exec: ActionExec;

  constructor(exec: ActionExec) {
    this.exec = exec;
  }

  private static simple(f: SimpleActionExec) {
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

  private static match(r: RegExp) {
    return Action.simple((buffer) => {
      let res = r.exec(buffer);
      if (res && res.index != -1) return res.index + res[0].length;
      return 0;
    });
  }

  static from(r: ActionSource) {
    return r instanceof RegExp
      ? Action.match(r)
      : r instanceof Action
      ? r
      : Action.simple(r);
  }

  /**
   * Mute action if `accept` is `true`.
   */
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
}
