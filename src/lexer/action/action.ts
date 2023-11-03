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

/**
 * User defined action execution function.
 */
export type ActionExec<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionExecOutput<Data, ErrorType>;

/**
 * Wrapped action execution function.
 * The `AcceptedActionOutput.buffer/start` will be set by the action.
 */
export type WrappedActionExec<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionOutput<Data, ErrorType>;

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

/**
 * These types can be transformed into an `Action` by {@link Action.from}.
 */
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
  readonly wrapped: WrappedActionExec<Data, ActionState, ErrorType>;
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

  /**
   * Make constructor private to prevent user from creating action directly,
   * because we don't want the user to construct the ActionOutput directly.
   *
   * We have to make sure the `AcceptedActionOutput.buffer/start` is the same
   * with `ActionInput.buffer/start`.
   *
   * So for most cases, use {@link Action.exec} is recommended.
   * It will set `AcceptedActionOutput.buffer/start` automatically.
   */
  private constructor(
    wrapped: WrappedActionExec<Data, ActionState, ErrorType>,
    maybeMuted: boolean,
  ) {
    this.wrapped = wrapped;
    this.maybeMuted = maybeMuted;
  }

  /**
   * Create an `Action` from `ActionExec`.
   * This should be treat as the public constructor of `Action`.
   */
  static exec<Data = never, ActionState = never, ErrorType = never>(
    exec: ActionExec<Data, ActionState, ErrorType>,
    options?: Partial<Pick<Action<Data, ActionState, ErrorType>, "maybeMuted">>,
  ): Action<Data, ActionState, ErrorType> {
    return new Action(
      (input) => {
        const output = exec(input);
        if (output.accept) return AcceptedActionOutput.from(input, output);
        return rejectedActionOutput;
      },
      options?.maybeMuted ?? false,
    );
  }

  /**
   * Create an `Action` from `SimpleActionExec`.
   */
  static simple<Data = never, ActionState = never, ErrorType = never>(
    f: SimpleActionExec<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return Action.exec((input) => {
      const res = f(input);
      // if javascript support real function overload
      // we can move this type check out of the action's exec
      // to optimize performance
      if (typeof res === "number") {
        if (res <= 0) return rejectedActionOutput;
        return {
          accept: true,
          muted: false,
          digested: res,
          content: input.buffer.slice(input.start, input.start + res),
          data: undefined,
        } as AcceptedActionExecOutput<never, ErrorType>;
      }
      if (typeof res === "string") {
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

  /**
   * Create an `Action` from `RegExp`.
   * Set `token.data` to `RegExpExecArray`.
   * If you don't want to set `token.data`, use {@link Action.dryMatch} instead.
   */
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
    return Action.exec((input) => {
      r.lastIndex = input.start;
      const res = r.exec(input.buffer);
      if (res && res.index !== -1)
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

  /**
   * Create an `Action` from `RegExp` without setting `token.data`.
   * If you want to set `token.data`, use {@link Action.match} instead.
   */
  static dryMatch<ActionState = never, ErrorType = never>(
    ...props: Parameters<typeof Action.match<ActionState, ErrorType>>
  ) {
    return Action.match<ActionState, ErrorType>(...props).clearData();
  }

  /**
   * Create an `Action` from `RegExp/Action/SimpleActionExec`.
   */
  static from<Data = never, ActionState = never, ErrorType = never>(
    r: IntoAction<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    return r instanceof RegExp
      ? // Action.match will set Data to RegExpExecArray so we need to clean it.
        // The result should be Action<never, ActionState, ErrorType>
        // but only when r is SimpleActionExec the Data will take effect
        // so its ok to cast the result to Action<Data, ActionState, ErrorType>
        (Action.dryMatch<ActionState, ErrorType>(r) as unknown as Action<
          Data,
          ActionState,
          ErrorType
        >)
      : r instanceof Action
      ? r
      : Action.simple<Data, ActionState, ErrorType>(r);
  }

  /**
   * Apply a decorator to this action.
   * Return a new action.
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
  ): Action<NewData, ActionState, NewErrorType> {
    const wrapped = this.wrapped;
    return new Action(
      (input) => {
        const output = wrapped(input);
        if (output.accept) {
          return decorator({
            input,
            output,
          });
        }
        return output;
      },
      optionsOverride?.maybeMuted ?? this.maybeMuted,
    );
  }

  /**
   * Mute action if `accept` is `true` and `muted` is/returned `true`.
   * Return a new action.
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
   * Return a new action.
   */
  check<NewErrorType>(
    condition: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => NewErrorType | undefined,
  ): Action<Data, ActionState, NewErrorType> {
    return this.apply((ctx) => {
      // in javascript, type casting should be faster than creating a new object
      // so we don't create a new AcceptedActionOutput, just cast and modify it
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
   * Return a new action.
   */
  error<NewErrorType>(
    error: NewErrorType,
  ): Action<Data, ActionState, NewErrorType> {
    return this.check(() => error);
  }

  /**
   * Set data if `accept` is `true`.
   * Return a new action.
   */
  data<NewData>(
    factory: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => NewData,
  ): Action<NewData, ActionState, ErrorType> {
    return this.apply((ctx) => {
      // in javascript, type casting should be faster than creating a new object
      // so we don't create a new AcceptedActionOutput, just cast and modify it
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
   * Return a new action.
   */
  clearData(): Action<never, ActionState, ErrorType> {
    return this.data(() => undefined as never);
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   * Return a new action.
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
      if (rejecter) return new Action(() => rejectedActionOutput, false);
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
   * You can modify the action state in `f`.
   * Return a new action.
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
   * Execute the new action if current action can't accept input.
   * Return a new action.
   */
  or(
    a: IntoAction<Data, ActionState, ErrorType>,
  ): Action<Data, ActionState, ErrorType> {
    const wrapped = this.wrapped;
    const other = Action.from(a);
    const otherWrapped = other.wrapped;
    return new Action((input) => {
      const output = wrapped(input);
      if (output.accept) return output;
      return otherWrapped(input);
    }, this.maybeMuted || other.maybeMuted);
  }

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   * Return a new action.
   */
  static reduce<Data = never, ActionState = never, ErrorType = never>(
    ...actions: IntoAction<Data, ActionState, ErrorType>[]
  ): Action<Data, ActionState, ErrorType> {
    return actions.map((a) => Action.from(a)).reduce((a, b) => a.or(b));
  }

  /**
   * Set kinds for this action. This is used if your action can yield multiple kinds.
   * @example
   * builder.select(a => a.from(...).kinds(...).map(...))
   */
  kinds<Kinds extends string>(...kinds: Kinds[]) {
    return new ActionWithKinds(kinds, this);
  }
}
