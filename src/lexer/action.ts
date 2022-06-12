export type ActionOutput =
  | { accept: false }
  | {
      accept: true; // this action can accept some input as a token
      mute: boolean; // don't emit token, continue loop
      digested: number; // how many chars are accepted by this action
      error: any; // empty if no error
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
      return n > 0
        ? {
            accept: true,
            mute: false,
            digested: n,
            error: null,
          }
        : { accept: false };
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
      if (output.accept) output.mute = enable;
      return output;
    });
  }

  /**
   * Check token content if `accept` is `true`.
   * `condition` should return error, empty error message means no error.
   */
  check(condition: (content: string) => any) {
    return new Action((buffer) => {
      let output = this.exec(buffer);
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
      let output = this.exec(buffer);
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
      let output = this.exec(buffer);
      if (output.accept) f(buffer.slice(0, output.digested));
      return output;
    });
  }
}
