import { CaretNotAllowedError } from "../error";
import type { ActionInput } from "./input";
import type { ActionOutput, SimpleAcceptedActionOutput } from "./output";
import { rejectedActionOutput, AcceptedActionOutput } from "./output";

export type ActionExec<Data, ErrorType, ActionState> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionOutput<Data, ErrorType>;

/**
 * If return a number, the number is how many chars are digested. If the number <= 0, reject.
 */
export type SimpleActionExec<Data, ErrorType, ActionState> = (
  input: Readonly<ActionInput<ActionState>>,
) => number | string | SimpleAcceptedActionOutput<Data, ErrorType>;

export type ActionSource<Data, ErrorType, ActionState> =
  | RegExp
  | Action<Data, ErrorType, ActionState>
  | SimpleActionExec<Data, ErrorType, ActionState>;

export type ActionDecoratorContext<Data, ErrorType, ActionState> = {
  input: Readonly<ActionInput<ActionState>>;
  output: Readonly<AcceptedActionOutput<Data, ErrorType>>;
};

export class Action<Data = never, ErrorType = string, ActionState = never> {
  readonly exec: ActionExec<Data, ErrorType, ActionState>;
  /**
   * Callback should only be called if `peek` is `false`.
   */
  readonly callback?: (
    ctx: ActionDecoratorContext<Data, ErrorType, ActionState>,
  ) => void;
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
    exec: ActionExec<Data, ErrorType, ActionState>,
    options?: Partial<
      Pick<Action<Data, ErrorType, ActionState>, "maybeMuted" | "callback">
    >,
  ) {
    this.exec = exec;
    this.callback = options?.callback;
    this.maybeMuted = options?.maybeMuted ?? false;
  }

  static simple<Data = never, ErrorType = string, ActionState = never>(
    f: SimpleActionExec<Data, ErrorType, ActionState>,
  ): Action<Data, ErrorType, ActionState> {
    return new Action((input) => {
      const res = f(input);
      if (typeof res == "number") {
        if (res <= 0) return rejectedActionOutput;
        return new AcceptedActionOutput<Data, ErrorType>({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res,
          content: input.buffer.slice(input.start, input.start + res),
          data: undefined as never,
        });
      }
      if (typeof res == "string") {
        if (res.length <= 0) return rejectedActionOutput;
        return new AcceptedActionOutput<Data, ErrorType>({
          buffer: input.buffer,
          start: input.start,
          muted: false,
          digested: res.length,
          content: res,
          data: undefined as never,
        });
      }
      // else, res is SimpleAcceptedActionOutput
      res.digested ??= res.content!.length; // if digested is undefined, content must be defined
      if (res.digested <= 0) return rejectedActionOutput;
      return new AcceptedActionOutput<Data, ErrorType>({
        buffer: input.buffer,
        start: input.start,
        muted: res.muted ?? false,
        digested: res.digested,
        error: res.error,
        content:
          res.content ??
          input.buffer.slice(input.start, input.start + res.digested),
        rest: res.rest,
        data: undefined as never,
      });
    });
  }

  static match<Data = never, ErrorType = string, ActionState = never>(
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
    },
  ): Action<Data, ErrorType, ActionState> {
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
        return new AcceptedActionOutput<Data, ErrorType>({
          muted: false,
          digested: res[0].length,
          buffer: input.buffer,
          start: input.start,
          content: res[0], // reuse the regex result
          data: undefined as never,
        });
      return rejectedActionOutput;
    });
  }

  static from<Data = never, ErrorType = string, ActionState = never>(
    r: ActionSource<Data, ErrorType, ActionState>,
  ): Action<Data, ErrorType, ActionState> {
    return r instanceof RegExp
      ? Action.match<Data, ErrorType, ActionState>(r)
      : r instanceof Action
      ? r
      : Action.simple<Data, ErrorType, ActionState>(r);
  }

  /**
   * Mute action if `accept` is `true` and `muted` is/returned `true`.
   */
  mute(
    muted:
      | boolean
      | ((
          ctx: ActionDecoratorContext<Data, ErrorType, ActionState>,
        ) => boolean) = true,
  ): Action<Data, ErrorType, ActionState> {
    if (typeof muted === "boolean")
      return new Action<Data, ErrorType, ActionState>(
        (input) => {
          const output = this.exec(input);
          if (output.accept) {
            output.muted = muted;
            return output;
          }
          return output;
        },
        { maybeMuted: muted, callback: this.callback },
      );
    // else, muted is a function
    return new Action<Data, ErrorType, ActionState>(
      (input) => {
        const output = this.exec(input);
        if (output.accept) {
          output.muted = muted({ input, output });
          return output;
        }
        return output;
      },
      { maybeMuted: true, callback: this.callback },
    );
  }

  /**
   * Check the output if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check<NewErrorType>(
    condition: (
      ctx: ActionDecoratorContext<Data, NewErrorType, ActionState>,
    ) => NewErrorType | undefined,
  ): Action<Data, NewErrorType, ActionState> {
    return new Action<Data, NewErrorType, ActionState>(
      (input) => {
        const output = this.exec(input);
        if (output.accept) {
          const converted = output as unknown as AcceptedActionOutput<
            Data,
            NewErrorType
          >;
          converted.error = condition({ input, output: converted });
          return converted;
        }
        return output;
      },
      {
        callback: this.callback as unknown as (
          ctx: ActionDecoratorContext<Data, NewErrorType, ActionState>,
        ) => void | undefined,
      },
    );
  }

  /**
   * Set error if `accept` is `true`.
   */
  error<NewErrorType>(
    error: NewErrorType,
  ): Action<Data, NewErrorType, ActionState> {
    return new Action<Data, NewErrorType, ActionState>(
      (input) => {
        const output = this.exec(input);
        if (output.accept) {
          const converted = output as unknown as AcceptedActionOutput<
            Data,
            NewErrorType
          >;
          converted.error = error;
          return converted;
        }
        return output;
      },
      {
        callback: this.callback as unknown as (
          ctx: ActionDecoratorContext<Data, NewErrorType, ActionState>,
        ) => void | undefined,
      },
    );
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   */
  reject(
    rejecter:
      | boolean
      | ((
          ctx: ActionDecoratorContext<Data, ErrorType, ActionState>,
        ) => boolean) = true,
  ): Action<Data, ErrorType, ActionState> {
    if (typeof rejecter === "boolean") {
      if (rejecter) return new Action(() => rejectedActionOutput); // always reject, don't need callback
      return this; // just return self, don't override the original output's accept
    }
    return new Action<Data, ErrorType, ActionState>(
      (input) => {
        const output = this.exec(input);
        if (output.accept) {
          if (rejecter({ input, output })) return rejectedActionOutput;
          else return output;
        }
        return output;
      },
      { callback: this.callback },
    );
  }

  /**
   * Call `f` if `accept` is `true`.
   */
  then(
    f: (ctx: ActionDecoratorContext<Data, ErrorType, ActionState>) => void,
  ): Action<Data, ErrorType, ActionState> {
    return new Action<Data, ErrorType, ActionState>(this.exec, {
      callback: (ctx) => {
        this.callback?.(ctx);
        f(ctx);
      },
    });
  }

  /**
   * Execute the new action if current action can't accept input.
   * Sadly there is no operator overloading in typescript.
   */
  or(
    a: ActionSource<Data, ErrorType, ActionState>,
  ): Action<Data, ErrorType, ActionState> {
    const other = Action.from(a);
    return new Action<Data, ErrorType, ActionState>(
      (input) => {
        const output = this.exec(input);
        if (output.accept) return output;
        return other.exec(input);
      },
      {
        maybeMuted: this.maybeMuted || other.maybeMuted,
        callback: (ctx) => {
          this.callback?.(ctx);
          other.callback?.(ctx);
        },
      },
    );
  }

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   */
  static reduce<Data = never, ErrorType = string, ActionState = never>(
    ...actions: ActionSource<Data, ErrorType, ActionState>[]
  ): Action<Data, ErrorType, ActionState> {
    return Action.from<Data, ErrorType, ActionState>(
      actions.reduce((a, b) =>
        Action.from<Data, ErrorType, ActionState>(a).or(b),
      ),
    );
  }
}
