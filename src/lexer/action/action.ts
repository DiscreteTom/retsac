import type { ActionInput } from "./input";
import type {
  SimpleAcceptedActionExecOutput,
  ActionExecOutput,
  ActionOutput,
  AcceptedActionExecOutput,
} from "./output";
import { rejectedActionOutput, AcceptedActionOutput } from "./output";
import { ActionWithKinds } from "./select";
import { checkRegexNotStartsWithCaret, makeRegexAutoSticky } from "./utils";

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

export type AcceptedActionDecorator<
  Data,
  ActionState,
  ErrorType,
  NewData,
  NewErrorType,
> = (
  ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
) => ActionOutput<NewData, NewErrorType>;

export class Action<Data = never, ActionState = never, ErrorType = never> {
  // TODO: better name?
  exec: (
    input: Readonly<ActionInput<ActionState>>,
  ) => ActionOutput<Data, ErrorType>;
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
    this.exec = (input) => {
      const output = exec(input);
      if (output.accept) return AcceptedActionOutput.from(input, output);
      return rejectedActionOutput;
    };
    this.maybeMuted = options?.maybeMuted ?? false;
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
          data: undefined,
        } as AcceptedActionExecOutput<never, ErrorType>;
      }
      if (typeof res == "string") {
        if (res.length <= 0) return rejectedActionOutput;
        return {
          accept: true,
          muted: false,
          digested: res.length,
          content: res,
          data: undefined,
        } as AcceptedActionExecOutput<never, ErrorType>;
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
        data: res.data,
        rest: res.rest,
      } as AcceptedActionExecOutput<Data, ErrorType>;
    });
  }

  static match<ActionState = never, ErrorType = never>(
    r: RegExp,
    options?: {
      /**
       * Auto add the sticky flag to the regex if `g` and `y` is not set.
       * @default true
       */
      autoSticky?: boolean;
      /**
       * Reject if the regex starts with `^`.
       * @default true
       */
      rejectCaret?: boolean;
    },
  ): Action<RegExpExecArray, ActionState, ErrorType> {
    if (options?.autoSticky ?? true) r = makeRegexAutoSticky(r);
    if (options?.rejectCaret ?? true) checkRegexNotStartsWithCaret(r);

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
          data: res,
        };
      return rejectedActionOutput;
    });
  }

  static from<Data = never, ActionState = never, ErrorType = never>(
    r: IntoAction<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return r instanceof RegExp
      ? // Action.match will set Data to RegExpExecArray so we need to clean it.
        // The result should be Action<never, ActionState, ErrorType>
        // but only when r is SimpleActionExec the Data will take effect
        // so its ok to cast the result to Action<Data, ActionState, ErrorType>
        (Action.match<ActionState, ErrorType>(
          r,
        ).clearData() as unknown as Action<Data, ActionState, ErrorType>)
      : r instanceof Action
      ? r
      : Action.simple<Data, ActionState, ErrorType>(r);
  }

  /**
   * Apply a decorator to this action.
   */
  apply<NewData, NewErrorType>(
    decorator: AcceptedActionDecorator<
      Data,
      ActionState,
      ErrorType,
      NewData,
      NewErrorType
    >,
    optionsOverride?: Partial<
      Pick<Action<NewData, ActionState, NewErrorType>, "maybeMuted">
    >,
  ) {
    const exec = this.exec;
    const _this = this as unknown as Action<NewData, ActionState, NewErrorType>;
    _this.exec = (input) => {
      const output = exec(input);
      if (output.accept) {
        return decorator({
          input,
          output,
        });
      }
      return output;
    };
    _this.maybeMuted = optionsOverride?.maybeMuted ?? _this.maybeMuted;
    return _this;
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
      return this.apply((ctx) => {
        ctx.output.muted = muted;
        return ctx.output;
      });
    } else {
      // muted is a function
      return this.apply((ctx) => {
        ctx.output.muted = muted(ctx);
        return ctx.output;
      });
    }
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
    return this.apply((ctx) => {
      const output = ctx.output as unknown as AcceptedActionOutput<
        Data,
        NewErrorType
      >;
      output.error = condition(ctx);
      return output;
    });
  }

  /**
   * Set error if `accept` is `true`.
   */
  error<NewErrorType>(
    error: NewErrorType,
  ): Action<Data, ActionState, NewErrorType> {
    return this.check(() => error);
  }

  /**
   * Set data if `accept` is `true`.
   */
  data<NewData>(
    factory: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => NewData,
  ): Action<NewData, ActionState, ErrorType> {
    return this.apply((ctx) => {
      const output = ctx.output as unknown as AcceptedActionOutput<
        NewData,
        ErrorType
      >;
      output.data = factory(ctx);
      return output;
    });
  }

  /**
   * Set data to `undefined` if `accept` is `true`.
   */
  clearData(): Action<never, ActionState, ErrorType> {
    return this.data(() => undefined as never);
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
      // always reject
      // ignore maybeMuted since muted is only used when accept is true
      if (rejecter) return new Action(() => rejectedActionOutput);
      // else, always accept, just return self, don't override the original output's accept
      return this;
    }
    // else, rejecter is a function
    return this.apply((ctx) => {
      if (rejecter(ctx)) return rejectedActionOutput;
      return ctx.output;
    });
  }

  /**
   * Call `f` if `accept` is `true` and `peek` is `false`.
   */
  then(
    f: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => void,
  ): Action<Data, ActionState, ErrorType> {
    return this.apply((ctx) => {
      if (!ctx.input.peek) f(ctx);
      return ctx.output;
    });
  }

  /**
   * Set kinds for this action. This is used if your action can yield multiple kinds.
   * @example
   * builder.select(a => a.from(...).kinds(...).map(...))
   */
  kinds<Kinds extends string>(...kinds: Kinds[]) {
    return new ActionWithKinds(kinds, this);
  }

  /**
   * Execute the new action if current action can't accept input.
   */
  or<NewData, NewErrorType>(
    a: IntoAction<NewData, ActionState, NewErrorType>,
  ): Action<Data | NewData, ActionState, ErrorType | NewErrorType> {
    const exec = this.exec;
    const other = Action.from(a);
    const otherExec = other.exec;
    const _this = this as unknown as Action<
      Data | NewData,
      ActionState,
      ErrorType | NewErrorType
    >;
    _this.exec = (input) => {
      const output = exec(input);
      if (output.accept) return output;
      return otherExec(input);
    };
    _this.maybeMuted ||= other.maybeMuted;
    return _this;
  }

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   */
  static reduce<Data = never, ActionState = never, ErrorType = never>(
    ...actions: IntoAction<Data, ActionState, ErrorType>[]
  ): Action<Data, ActionState, ErrorType> {
    return Action.from<Data, ActionState, ErrorType>(
      actions.reduce((a, b) =>
        Action.from<Data, ActionState, ErrorType>(a).or(b),
      ),
    );
  }
}
