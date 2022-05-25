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

  /**
   * Transform content if `accept` is true.
   */
  transform(f: (content: string) => string) {
    return new Action((buffer) => {
      let output = this.exec(buffer);
      if (output.accept) {
        output.content = f(output.content);
      }
      return output;
    });
  }
}
