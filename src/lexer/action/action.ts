import { CaretNotAllowedError } from "../error";
import {
  ActionInput,
  ActionOutput,
  SimpleAcceptedActionOutput,
  AcceptedActionOutput,
  rejectedActionOutput,
} from "./model";

export type ActionExec<E> = (input: Readonly<ActionInput>) => ActionOutput<E>;

/**
 * If return a number, the number is how many chars are digested. If the number <= 0, reject.
 */
export type SimpleActionExec<E> = (
  input: Readonly<ActionInput>
) => number | string | SimpleAcceptedActionOutput<E>;

export type ActionSource<E> = RegExp | Action<E> | SimpleActionExec<E>;

export class Action<E> {
  readonly exec: ActionExec<E>;
  /**
   * This flag is to indicate whether this action's output might be muted.
   * The lexer will based on this flag to accelerate the lexing process.
   * If `true`, this action's output could be muted.
   * If `false`, this action's output should never be muted.
   * For most cases this field will be set automatically,
   * so don't set this field unless you know what you are doing.
   */
  maybeMuted: boolean;

  /**
   * For most cases, you should use `Action.from/match/simple` instead of `new Action`.
   */
  constructor(
    exec: ActionExec<E>,
    options?: Partial<Pick<Action<E>, "maybeMuted">>
  ) {
    this.exec = exec;
    this.maybeMuted = options?.maybeMuted ?? false;
  }

  static simple<E>(f: SimpleActionExec<E>): Action<E> {
    return new Action((input) => {
      const res = f(input);
      if (typeof res == "number") {
        if (res <= 0) return rejectedActionOutput;
        return new AcceptedActionOutput<E>({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res,
          content: input.buffer.slice(input.start, input.start + res),
        });
      }
      if (typeof res == "string") {
        if (res.length <= 0) return rejectedActionOutput;
        return new AcceptedActionOutput<E>({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res.length,
          content: res,
        });
      }
      // else, res is SimpleAcceptedActionOutput
      res.digested ??= res.content!.length; // if digested is undefined, content must be defined
      if (res.digested <= 0) return rejectedActionOutput;
      return new AcceptedActionOutput<E>({
        buffer: input.buffer,
        start: input.start,
        muted: res.muted ?? false,
        digested: res.digested,
        error: res.error,
        content:
          res.content ??
          input.buffer.slice(input.start, input.start + res.digested),
        rest: res.rest,
      });
    });
  }

  static match<E>(
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
  ): Action<E> {
    if (options?.autoSticky ?? true) {
      if (!r.sticky && !r.global)
        // make sure r has the flag 'y/g' so we can use `r.lastIndex` to reset state.
        r = new RegExp(r.source, r.flags + "y");
    }
    if (options?.rejectCaret ?? true) {
      if (r.source.startsWith("^"))
        // for most cases this is a mistake
        // since when 'r' and 'g' is set, '^' will cause the regex to always fail when 'r.lastIndex' is not 0
        throw new CaretNotAllowedError();
    }

    // use `new Action` instead of `Action.simple` to re-use the `res[0]`
    return new Action((input) => {
      r.lastIndex = input.start;
      const res = r.exec(input.buffer);
      if (res && res.index != -1)
        return new AcceptedActionOutput<E>({
          muted: false,
          digested: res[0].length,
          buffer: input.buffer,
          start: input.start,
          content: res[0], // reuse the regex result
        });
      return rejectedActionOutput;
    });
  }

  static from<E>(r: ActionSource<E>): Action<E> {
    return r instanceof RegExp
      ? Action.match<E>(r)
      : r instanceof Action
      ? r
      : Action.simple<E>(r);
  }

  /**
   * Mute action if `accept` is `true` and `muted` is/returned `true`.
   */
  mute(
    muted:
      | boolean
      | ((output: Readonly<AcceptedActionOutput<E>>) => boolean) = true
  ) {
    if (typeof muted === "boolean")
      return new Action(
        (input) => {
          const output = this.exec(input);
          if (output.accept) {
            output.muted = muted;
            return output;
          }
          return output;
        },
        { maybeMuted: muted }
      );
    // else, muted is a function
    return new Action(
      (input) => {
        const output = this.exec(input);
        if (output.accept) {
          output.muted = muted(output);
          return output;
        }
        return output;
      },
      { maybeMuted: true }
    );
  }

  /**
   * Check the output if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check<T>(
    condition: (output: Readonly<AcceptedActionOutput<E>>) => T | undefined
  ) {
    return new Action<T>((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) {
        const converted = output as any as AcceptedActionOutput<T>;
        converted.error = condition(output);
        return converted;
      }
      return output;
    });
  }

  /**
   * Set error if `accept` is `true`.
   */
  error<T>(error: T) {
    return new Action((input) => {
      const output = this.exec(input);
      if (output.accept) {
        const converted = output as any as AcceptedActionOutput<T>;
        converted.error = error;
        return converted;
      }
      return output;
    });
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   */
  reject(
    rejecter:
      | boolean
      | ((output: Readonly<AcceptedActionOutput<E>>) => boolean) = true
  ) {
    if (typeof rejecter === "boolean") {
      if (rejecter) return new Action(() => rejectedActionOutput); // always reject
      return this; // just return self, don't override the original output's accept
    }
    return new Action((buffer) => {
      const output = this.exec(buffer);
      if (output.accept) {
        if (rejecter(output)) return rejectedActionOutput;
        else return output;
      }
      return output;
    });
  }

  /**
   * Call `f` if `accept` is `true`.
   */
  then(f: (output: Readonly<AcceptedActionOutput<E>>) => void) {
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
  or(a: ActionSource<E>) {
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

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   */
  static reduce<E>(...actions: ActionSource<E>[]) {
    return Action.from<E>(actions.reduce((a, b) => Action.from<E>(a).or(b)));
  }
}
