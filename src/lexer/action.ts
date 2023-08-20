export type ActionAcceptedOutput = Readonly<{
  /** This action can accept some input as a token. */
  accept: true;
  /** Don't emit token, continue lex. */
  muted: boolean;
  /** How many chars are accepted by this action. */
  digested: number;
  /**
   * The content of the token.
   * This field is to cache the result of `input.slice(0, digested)` to prevent duplicate calculation.
   */
  content: string; // TODO: make this lazy?
  /**
   *  The rest of the input.
   * This field is to cache the result of `input.slice(digested)` to prevent duplicate calculation.
   */
  rest: string; // TODO: make this lazy?
  error?: any; // TODO: use generic type?
}>;
export type ActionOutput = Readonly<{ accept: false }> | ActionAcceptedOutput;

export type ActionExec = (buffer: string) => ActionOutput;
/**
 * Only return how many chars are accepted. If > 0, accept.
 * This might be a little slower than `ActionExec`, since this function need to calculate the `content` and `rest`.
 */
export type SimpleActionExec = (buffer: string) => number;
export type ActionSource = RegExp | Action | SimpleActionExec;

export class Action {
  readonly exec: ActionExec;
  /**
   * This flag is to indicate whether this action's output might be muted.
   * The lexer will based on this flag to accelerate the lexing process.
   * If `true`, this action's output could be muted.
   * If `false`, this action's output should never be muted.
   */
  maybeMuted: boolean;

  constructor(exec: ActionExec, options?: Partial<Pick<Action, "maybeMuted">>) {
    this.exec = exec;
    this.maybeMuted = options?.maybeMuted ?? false;
  }

  private static simple(f: SimpleActionExec) {
    return new Action((buffer) => {
      const n = f(buffer);
      return n > 0
        ? {
            accept: true,
            muted: false,
            digested: n,
            content: buffer.slice(0, n),
            rest: buffer.slice(n),
          }
        : { accept: false };
    });
  }

  private static match(r: RegExp) {
    // use `new Action` instead of `Action.simple` to re-use the `res[0]` to prevent unnecessary string copy.
    return new Action((buffer) => {
      const res = r.exec(buffer);
      r.lastIndex = 0; // reset state if r has the flag 'g'
      if (res && res.index != -1)
        return {
          accept: true,
          muted: false,
          digested: res.index + res[0].length,
          content: res[0],
          rest: buffer.slice(res.index + res[0].length),
        };
      return { accept: false };
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
   * Reduce actions to one action.
   * This will reduce the lexer loop times to optimize the performance.
   */
  static reduce(...actions: ActionSource[]) {
    return Action.from(actions.reduce((a, b) => Action.from(a).or(b)));
  }

  /**
   * Mute action if `accept` is `true`.
   */
  mute(muted: boolean | ((content: string) => boolean) = true) {
    if (typeof muted === "boolean")
      return new Action(
        (buffer) => {
          const output = this.exec(buffer);
          if (output.accept) return { ...output, muted };
          return output;
        },
        { maybeMuted: muted }
      );
    return new Action(
      (buffer) => {
        const output = this.exec(buffer);
        if (output.accept) return { ...output, muted: muted(output.content) };
        return output;
      },
      { maybeMuted: true }
    );
  }

  /**
   * Check token content if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check(condition: (content: string) => any) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) return { ...output, error: condition(output.content) };
      return output;
    });
  }

  /**
   * Set error if `accept` is `true`.
   */
  error(error: any) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) return { ...output, error };
      return output;
    });
  }

  /**
   * Reject if `accept` is `true` and `rejecter` returns `true`.
   */
  reject(rejecter: boolean | ((content: string) => any) = true) {
    if (typeof rejecter === "boolean")
      return new Action((buffer) => {
        const output = this.exec(buffer);
        if (output.accept) {
          if (rejecter) return { accept: false };
          else return output;
        }
        return output;
      });
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) {
        if (rejecter(output.content)) return { accept: false };
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
      if (output.accept) f(output.content);
      return output;
    });
  }

  /**
   * Execute the new action if current action can't accept input.
   */
  or(a: ActionSource) {
    // sadly there is no operator overloading in typescript
    const other = Action.from(a);
    return new Action(
      (buffer) => {
        const output = this.exec(buffer);
        if (output.accept) return output;
        return other.exec(buffer);
      },
      {
        maybeMuted: this.maybeMuted || other.maybeMuted,
      }
    );
  }
}
