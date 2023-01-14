export type ActionOutput =
  | { accept: false }
  | {
      /** This action can accept some input as a token. */
      accept: true;
      /** Don't emit token, continue lex. */
      muted: boolean;
      /** How many chars are accepted by this action. */
      digested: number;
      error?: any;
    };

export type ActionExec = (buffer: string) => ActionOutput;
/** Only return how many chars are accepted. If > 0, accept. */
export type SimpleActionExec = (buffer: string) => number;
export type ActionSource = RegExp | Action | SimpleActionExec;

export class Action {
  readonly exec: ActionExec;

  constructor(exec: ActionExec) {
    this.exec = exec;
  }

  private static simple(f: SimpleActionExec) {
    return new Action((buffer) => {
      const n = f(buffer);
      return n > 0
        ? {
            accept: true,
            muted: false,
            digested: n,
          }
        : { accept: false };
    });
  }

  private static match(r: RegExp) {
    return Action.simple((buffer) => {
      const res = r.exec(buffer);
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
  mute(muted = true) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) output.muted = muted;
      return output;
    });
  }

  /**
   * Check token content if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check(condition: (content: string) => any) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept)
        output.error = condition(buffer.slice(0, output.digested));
      return output;
    });
  }

  /**
   * Reject if `accept` is `true` and `rejecter` returns `true`.
   */
  reject(rejecter: (content: string) => any) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) {
        if (rejecter(buffer.slice(0, output.digested)))
          return { accept: false };
        else return output;
      }
      return output;
    });
  }

  /**
   * Call `f` if `accept` is `true`.
   */
  then(f: (content: string) => void) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) f(buffer.slice(0, output.digested));
      return output;
    });
  }
}
