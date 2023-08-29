import {
  ActionInput,
  ActionOutput,
  SimpleAcceptedActionOutput,
  AcceptedActionOutput,
} from "./model";

export type ActionExec = (input: ActionInput) => ActionOutput;

/**
 * If return a number, the number is how many chars are digested. If the number <= 0, reject.
 */
export type SimpleActionExec = (
  input: ActionInput
) => number | string | SimpleAcceptedActionOutput;

export type ActionSource = RegExp | Action | SimpleActionExec;

export class Action {
  readonly exec: ActionExec;
  /**
   * This flag is to indicate whether this action's output might be muted.
   * The lexer will based on this flag to accelerate the lexing process.
   * If `true`, this action's output could be muted.
   * If `false`, this action's output should never be muted.
   * For most cases this field will be set automatically,
   * so don't set this field unless you know what you are doing.
   */
  maybeMuted: boolean;

  constructor(exec: ActionExec, options?: Partial<Pick<Action, "maybeMuted">>) {
    this.exec = exec;
    this.maybeMuted = options?.maybeMuted ?? false;
  }

  static simple(f: SimpleActionExec) {
    return new Action((input) => {
      const res = f(input);
      if (typeof res == "number") {
        if (res <= 0) return { accept: false };
        return new AcceptedActionOutput({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res,
        });
      }
      if (typeof res == "string") {
        if (res.length <= 0) return { accept: false };
        return new AcceptedActionOutput({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res.length,
          content: res,
        });
      }
      // else, res is SimpleAcceptedActionOutput
      res.digested ??= res.content!.length ?? 0; // if digested is undefined, content must be defined
      if (res.digested <= 0) return { accept: false };
      return new AcceptedActionOutput({
        buffer: input.buffer,
        start: input.start,
        muted: res.muted ?? false,
        digested: res.digested,
        error: res.error,
        content: res.content,
        _rest: res.rest,
      });
    });
  }

  static match(
    r: RegExp,
    options?: {
      /**
       * Auto add the sticky flag to the regex if `g` and `y` is not set.
       * Default: `true`.
       */
      autoSticky?: boolean;
      /**
       * Reject if the regex starts with `^`.
       * Default: `true`.
       */
      rejectCaret?: boolean;
    }
  ) {
    if (options?.autoSticky ?? true) {
      if (!r.sticky && !r.global)
        // make sure r has the flag 'y/g' so we can use `r.lastIndex` to reset state.
        r = new RegExp(r.source, r.flags + "y");
    }
    if (options?.rejectCaret ?? true) {
      if (r.source.startsWith("^"))
        // for most cases this is a mistake
        // since when 'r' and 'g' is set, '^' will cause the regex to always fail when 'r.lastIndex' is not 0
        throw new Error("regex starts with '^' is not allowed"); // TODO: use typed error
    }

    // use `new Action` instead of `Action.simple` to re-use the `res[0]`
    return new Action((input) => {
      r.lastIndex = input.start;
      const res = r.exec(input.buffer);
      if (res && res.index != -1)
        return new AcceptedActionOutput({
          muted: false,
          digested: res[0].length,
          buffer: input.buffer,
          start: input.start,
          content: res[0], // reuse the regex result
        });
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
   * Mute action if `accept` is `true` and `muted` is/returned `true`.
   */
  mute(muted: boolean | ((output: AcceptedActionOutput) => boolean) = true) {
    if (typeof muted === "boolean")
      return new Action(
        (input) => {
          const output = this.exec(input);
          if (output.accept)
            return AcceptedActionOutput.from(output, { muted });
          return output;
        },
        { maybeMuted: muted }
      );
    return new Action(
      (input) => {
        const output = this.exec(input);
        if (output.accept)
          return AcceptedActionOutput.from(output, { muted: muted(output) });
        return output;
      },
      { maybeMuted: true }
    );
  }

  /**
   * Check the output if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check(condition: (output: AcceptedActionOutput) => any) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept)
        return AcceptedActionOutput.from(output, { error: condition(output) });
      return output;
    });
  }

  /**
   * Set error if `accept` is `true`.
   */
  error(error: any) {
    return new Action((input) => {
      const output = this.exec(input);
      if (output.accept) return AcceptedActionOutput.from(output, { error });
      return output;
    });
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   */
  reject(rejecter: boolean | ((output: AcceptedActionOutput) => any) = true) {
    if (typeof rejecter === "boolean") {
      if (rejecter) return new Action(() => ({ accept: false })); // always reject
      return this; // just return self
    }
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) {
        if (rejecter(output)) return { accept: false };
        else return output;
      }
      return output;
    });
  }

  /**
   * Call `f` if `accept` is `true`.
   */
  then(f: (output: AcceptedActionOutput) => void) {
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) f(output);
      return output;
    });
  }

  /**
   * Execute the new action if current action can't accept input.
   * Sadly there is no operator overloading in typescript.
   */
  or(a: ActionSource) {
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