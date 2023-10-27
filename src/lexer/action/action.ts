import { CaretNotAllowedError } from "../error";
import type { ActionInput } from "./input";
import type {
  SimpleAcceptedActionExecOutput,
  ActionExecOutput,
  ActionOutput,
  AcceptedActionExecOutput,
} from "./output";
import { rejectedActionOutput, AcceptedActionOutput } from "./output";

export type ActionExec<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionExecOutput<Data, ErrorType>;

/**
 * If return a number, the number is how many chars are digested. If the number <= 0, reject.
 *
 * If return a string, the string is the content. If the string is empty, reject.
 *
 * If return a SimpleAcceptedActionExecOutput, missing fields will be filled automatically.
 */
export type SimpleActionExec<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => number | string | SimpleAcceptedActionExecOutput<Data, ErrorType>;

export type IntoAction<Data, ActionState, ErrorType> =
  | RegExp
  | Action<Data, ActionState, ErrorType>
  | SimpleActionExec<Data, ActionState, ErrorType>;

export type AcceptedActionDecoratorContext<Data, ActionState, ErrorType> = {
  readonly input: Readonly<ActionInput<ActionState>>;
  readonly output: AcceptedActionOutput<Data, ErrorType>;
};

export type AcceptedActionDecorator<Data, ActionState, ErrorType> = (
  ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
) => ActionOutput<Data, ErrorType>;

export class Action<Data = never, ActionState = never, ErrorType = never> {
  readonly _exec: ActionExec<Data, ActionState, ErrorType>;
  readonly decorators: AcceptedActionDecorator<Data, ActionState, ErrorType>[];
  /**
   * This flag is to indicate whether this action's output might be muted.
   * The lexer will based on this flag to accelerate the lexing process.
   * If `true`, this action's output may be muted.
   * If `false`, this action's output will never be muted.
   * For most cases this field will be set automatically,
   * so don't set this field unless you know what you are doing.
   */
  maybeMuted: boolean;

  /**
   * If `true`, the action's output will never be muted.
   */
  get neverMuted() {
    return !this.maybeMuted;
  }

  constructor(
    exec: ActionExec<Data, ActionState, ErrorType>,
    options?: Partial<Pick<Action<Data, ActionState, ErrorType>, "maybeMuted">>,
  ) {
    this._exec = exec;
    this.decorators = [];
    this.maybeMuted = options?.maybeMuted ?? false;
  }

  exec(input: ActionInput<ActionState>): ActionOutput<Data, ErrorType> {
    const execOutput = this._exec(input);
    if (!execOutput.accept) return execOutput;

    let output = new AcceptedActionOutput({
      buffer: input.buffer,
      start: input.start,
      ...execOutput,
    });

    // apply decorators
    for (const d of this.decorators) {
      const o = d({ input, output });
      // if rejected, return the rejected output immediately
      if (!o.accept) return o;
      output = o;
    }
    return output;
  }

  static simple<Data = never, ActionState = never, ErrorType = never>(
    f: SimpleActionExec<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return new Action((input) => {
      const res = f(input);
      // if javascript support real function overload
      // we can move this type check out of the action's exec
      // to optimize performance
      if (typeof res == "number") {
        if (res <= 0) return rejectedActionOutput;
        return {
          accept: true,
          muted: false,
          digested: res,
          content: input.buffer.slice(input.start, input.start + res),
          data: undefined as never,
        } as AcceptedActionExecOutput<Data, ErrorType>;
      }
      if (typeof res == "string") {
        if (res.length <= 0) return rejectedActionOutput;
        return {
          accept: true,
          muted: false,
          digested: res.length,
          content: res,
          data: undefined as never,
        } as AcceptedActionExecOutput<Data, ErrorType>;
      }
      // else, res is SimpleAcceptedActionOutput
      res.digested ??= res.content!.length; // if digested is undefined, content must be defined
      if (res.digested <= 0) return rejectedActionOutput;
      return {
        accept: true,
        muted: res.muted ?? false,
        digested: res.digested,
        error: res.error,
        content:
          res.content ??
          input.buffer.slice(input.start, input.start + res.digested),
        rest: res.rest,
        data: undefined as never,
      } as AcceptedActionExecOutput<Data, ErrorType>;
    });
  }

  static match<Data = never, ActionState = never, ErrorType = never>(
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
  ): Action<Data, ActionState, ErrorType> {
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
        return {
          accept: true,
          muted: false,
          digested: res[0].length,
          buffer: input.buffer,
          start: input.start,
          content: res[0], // reuse the regex result
          data: undefined as never,
        } as AcceptedActionExecOutput<Data, ErrorType>;
      return rejectedActionOutput;
    });
  }

  static from<Data = never, ActionState = never, ErrorType = never>(
    r: IntoAction<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return r instanceof RegExp
      ? Action.match<Data, ActionState, ErrorType>(r)
      : r instanceof Action
      ? r
      : Action.simple<Data, ActionState, ErrorType>(r);
  }

  /**
   * Mute action if `accept` is `true` and `muted` is/returned `true`.
   */
  mute(
    muted:
      | boolean
      | ((
          ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
        ) => boolean) = true,
  ): Action<Data, ActionState, ErrorType> {
    if (typeof muted === "boolean") {
      this.maybeMuted = muted;
      this.decorators.push((ctx) => {
        if (ctx.output.accept) ctx.output.muted = muted;
        return ctx.output;
      });
      return this;
    }
    // else, muted is a function
    this.decorators.push((ctx) => {
      if (ctx.output.accept) ctx.output.muted = muted(ctx);
      return ctx.output;
    });
    this.maybeMuted = true;
    return this;
  }

  /**
   * Check the output if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   */
  check<NewErrorType>(
    condition: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => NewErrorType | undefined,
  ): Action<Data, ActionState, NewErrorType> {
    const _this = this as unknown as Action<Data, ActionState, NewErrorType>;
    _this.decorators.push((ctx) => {
      if (ctx.output.accept) {
        ctx.output.error = condition(
          ctx as unknown as AcceptedActionDecoratorContext<
            Data,
            ActionState,
            ErrorType
          >,
        );
        return ctx.output;
      }
      return ctx.output;
    });
    return _this;
  }

  /**
   * Set data if `accept` is `true`.
   */
  data<NewData>(
    factory: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => NewData,
  ): Action<NewData, ActionState, ErrorType> {
    const _this = this as unknown as Action<NewData, ActionState, ErrorType>;
    _this.decorators.push((ctx) => {
      if (ctx.output.accept) {
        ctx.output.data = factory(
          ctx as unknown as AcceptedActionDecoratorContext<
            Data,
            ActionState,
            ErrorType
          >,
        );
        return ctx.output;
      }
      return ctx.output;
    });
    return _this;
  }

  /**
   * Set error if `accept` is `true`.
   */
  error<NewErrorType>(
    error: NewErrorType,
  ): Action<Data, ActionState, NewErrorType> {
    const _this = this as unknown as Action<Data, ActionState, NewErrorType>;
    _this.decorators.push((ctx) => {
      if (ctx.output.accept) {
        ctx.output.error = error;
        return ctx.output;
      }
      return ctx.output;
    });
    return _this;
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   */
  reject(
    rejecter:
      | boolean
      | ((
          ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
        ) => boolean) = true,
  ): Action<Data, ActionState, ErrorType> {
    if (typeof rejecter === "boolean") {
      if (rejecter) return new Action(() => rejectedActionOutput); // always reject
      return this; // just return self, don't override the original output's accept
    }
    // else, rejecter is a function
    this.decorators.push((ctx) => {
      if (ctx.output.accept) {
        if (rejecter(ctx)) return rejectedActionOutput;
        else return ctx.output;
      }
      return ctx.output;
    });
    return this;
  }

  /**
   * Call `f` if `accept` is `true` and `peek` is `false`.
   */
  then(
    f: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => void,
  ): Action<Data, ActionState, ErrorType> {
    this.decorators.push((ctx) => {
      if (ctx.output.accept && !ctx.input.peek) f(ctx);
      return ctx.output;
    });
    return this;
  }

  /**
   * Execute the new action if current action can't accept input.
   * Sadly there is no operator overloading in typescript.
   */
  or(
    a: IntoAction<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    const other = Action.from(a);
    return new Action<Data, ActionState, ErrorType>(
      (input) => {
        const output = this._exec(input);
        if (output.accept) return output;
        return other._exec(input);
      },
      { maybeMuted: this.maybeMuted || other.maybeMuted },
    );
  }

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   */
  static reduce<Data = never, ErrorType = string, ActionState = never>(
    ...actions: IntoAction<Data, ActionState, ErrorType>[]
  ): Action<Data, ActionState, ErrorType> {
    return Action.from<Data, ActionState, ErrorType>(
      actions.reduce((a, b) =>
        Action.from<Data, ActionState, ErrorType>(a).or(b),
      ),
    );
  }
}
