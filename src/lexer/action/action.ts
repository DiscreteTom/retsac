import type {
  ExtractData,
  ExtractKinds,
  GeneralTokenDataBinding,
} from "../model";
import type { ActionInput } from "./input";
import type {
  SimpleAcceptedActionExecOutput,
  ActionExecOutput,
  ActionOutput,
  AcceptedActionExecOutput,
} from "./output";
import { rejectedActionOutput, AcceptedActionOutput } from "./output";
import { MultiKindsAction } from "./select";
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
export type WrappedActionExec<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionOutput<DataBindings, ErrorType>;

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
export type IntoAction<Kinds extends string, Data, ActionState, ErrorType> =
  | RegExp
  | Action<{ kind: Kinds; data: Data }, ActionState, ErrorType>
  | SimpleActionExec<Data, ActionState, ErrorType>;

export type AcceptedActionDecoratorContext<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = {
  readonly input: Readonly<ActionInput<ActionState>>;
  readonly output: AcceptedActionOutput<
    ExtractKinds<DataBindings>,
    ExtractData<DataBindings>,
    ErrorType
  >;
};

export type AcceptedActionDecorator<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
  NewDataBindings extends GeneralTokenDataBinding,
  NewErrorType,
> = (
  ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
) => ActionOutput<NewDataBindings, NewErrorType>;

export class Action<
  DataBindings extends GeneralTokenDataBinding = never,
  ActionState = never,
  ErrorType = never,
> {
  /**
   * The possible kinds this action can yield.
   * This should only be modified by {@link Action.kinds}.
   *
   * This is needed by `lexer.getTokenKinds` and `lexer.lex` with expectation.
   */
  readonly possibleKinds: ReadonlySet<ExtractKinds<DataBindings>>;
  readonly exec: WrappedActionExec<DataBindings, ActionState, ErrorType>;
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
    wrapped: WrappedActionExec<DataBindings, ActionState, ErrorType>,
    maybeMuted: boolean,
    possibleKinds: ReadonlySet<ExtractKinds<DataBindings>>,
  ) {
    this.exec = wrapped;
    this.maybeMuted = maybeMuted;
    this.possibleKinds = possibleKinds;
  }

  /**
   * Create an `Action` from `ActionExec`.
   * This should be treat as the public constructor of `Action`.
   */
  static exec<Data = undefined, ActionState = never, ErrorType = never>(
    exec: ActionExec<Data, ActionState, ErrorType>,
    options?: Partial<
      Pick<Action<never, ActionState, ErrorType>, "maybeMuted">
    >,
  ): Action<{ kind: never; data: Data }, ActionState, ErrorType> {
    return new Action(
      (input) => {
        const output = exec(input);
        if (output.accept) return AcceptedActionOutput.from(input, output);
        return rejectedActionOutput;
      },
      options?.maybeMuted ?? false,
      new Set(),
    );
  }

  /**
   * Create an `Action` from `SimpleActionExec`.
   */
  static simple<Data = undefined, ActionState = never, ErrorType = never>(
    f: SimpleActionExec<Data, ActionState, ErrorType>,
  ): Action<{ kind: never; data: Data }, ActionState, ErrorType> {
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
        } as AcceptedActionExecOutput<Data, ErrorType>;
      }
      if (typeof res === "string") {
        if (res.length <= 0) return rejectedActionOutput;
        return {
          accept: true,
          muted: false,
          digested: res.length,
          content: res,
          data: undefined,
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
  ): Action<{ kind: never; data: RegExpExecArray }, ActionState, ErrorType> {
    if (options?.autoSticky ?? true) r = makeRegexAutoSticky(r);
    if (options?.rejectCaret ?? true) checkRegexNotStartsWithCaret(r);

    // use `new Action` instead of `Action.simple` to re-use the `res[0]`
    return Action.exec((input) => {
      // javascript doesn't have a string view
      // so we use r.lastIndex to run the regex from the start position
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
    return Action.match<ActionState, ErrorType>(...props).purge();
  }

  /**
   * Create an `Action` from `RegExp/Action/SimpleActionExec`.
   */
  static from<
    Kinds extends string = never,
    Data = undefined,
    ActionState = never,
    ErrorType = never,
  >(
    r: IntoAction<Kinds, Data, ActionState, ErrorType>,
  ): Action<{ kind: Kinds; data: Data }, ActionState, ErrorType> {
    return r instanceof RegExp
      ? // Action.match will set Data to RegExpExecArray so we need to clean it.
        // The result should be Action<never, ActionState, ErrorType>
        // but only when r is SimpleActionExec the Data will take effect
        // so its ok to cast the result to Action<Data, ActionState, ErrorType>
        (Action.dryMatch<ActionState, ErrorType>(r) as unknown as Action<
          { kind: Kinds; data: Data },
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
  apply<NewDataBindings extends GeneralTokenDataBinding, NewErrorType>(
    decorator: AcceptedActionDecorator<
      DataBindings,
      ActionState,
      ErrorType,
      NewDataBindings,
      NewErrorType
    >,
    optionsOverride?: Partial<
      Pick<Action<DataBindings, ActionState, NewErrorType>, "maybeMuted">
    >,
  ): Action<NewDataBindings, ActionState, NewErrorType> {
    const wrapped = this.exec;
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
      this.possibleKinds as ReadonlySet<ExtractKinds<NewDataBindings>>,
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
          ctx: AcceptedActionDecoratorContext<
            DataBindings,
            ActionState,
            ErrorType
          >,
        ) => boolean) = true,
  ): Action<DataBindings, ActionState, ErrorType> {
    if (typeof muted === "boolean") {
      return this.apply(
        (ctx) => {
          ctx.output.muted = muted;
          return ctx.output;
        },
        { maybeMuted: muted },
      );
    } else {
      // muted is a function
      return this.apply(
        (ctx) => {
          ctx.output.muted = muted(ctx);
          return ctx.output;
        },
        // if muted is a function, we can't know whether the output will be muted
        // so we set maybeMuted to true
        { maybeMuted: true },
      );
    }
  }

  /**
   * Check the output if `accept` is `true`.
   * `condition` should return error, `undefined` means no error.
   * Return a new action.
   */
  check<NewErrorType>(
    condition: (
      ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
    ) => NewErrorType | undefined,
  ): Action<DataBindings, ActionState, NewErrorType> {
    return this.apply((ctx) => {
      // in javascript, type casting should be faster than creating a new object
      // so we don't create a new AcceptedActionOutput, just cast and modify it
      const output = ctx.output as unknown as AcceptedActionOutput<
        ExtractKinds<DataBindings>,
        ExtractData<DataBindings>,
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
  ): Action<DataBindings, ActionState, NewErrorType> {
    return this.check(() => error);
  }

  /**
   * Set data if `accept` is `true`.
   * This is used when your action can only yield one kind.
   * Return a new action.
   */
  data<NewData>(
    factory: (
      ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
    ) => NewData,
  ): Action<
    { kind: ExtractKinds<DataBindings>; data: NewData },
    ActionState,
    ErrorType
  > {
    return this.apply<
      { kind: ExtractKinds<DataBindings>; data: NewData },
      ErrorType
    >((ctx) => {
      // in javascript, type casting should be faster than creating a new object
      // so we don't create a new AcceptedActionOutput, just cast and modify it
      const output = ctx.output as unknown as AcceptedActionOutput<
        ExtractKinds<DataBindings>,
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
  purge(): Action<
    { kind: ExtractKinds<DataBindings>; data: undefined },
    ActionState,
    ErrorType
  > {
    return this.data(() => undefined);
  }

  /**
   * Reject if `accept` is `true` and `rejecter` is/returns `true`.
   * Return a new action.
   */
  reject(
    rejecter:
      | boolean
      | ((
          ctx: AcceptedActionDecoratorContext<
            DataBindings,
            ActionState,
            ErrorType
          >,
        ) => boolean) = true,
  ): Action<DataBindings, ActionState, ErrorType> {
    if (typeof rejecter === "boolean") {
      // always reject
      // ignore maybeMuted since muted is only used when accept is true
      if (rejecter)
        return new Action(
          () => rejectedActionOutput,
          false,
          this.possibleKinds,
        );
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
      ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
    ) => void,
  ): Action<DataBindings, ActionState, ErrorType> {
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
    a: IntoAction<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ActionState,
      ErrorType
    >,
  ): Action<DataBindings, ActionState, ErrorType> {
    const wrapped = this.exec;
    const other = Action.from(a);
    const otherWrapped = other.exec;
    return new Action(
      (input) => {
        const output = wrapped(input);
        if (output.accept) return output;
        return otherWrapped(input);
      },
      this.maybeMuted || other.maybeMuted,
      new Set([...this.possibleKinds, ...other.possibleKinds]),
    );
  }

  /**
   * Reduce actions to one action. Actions will be executed in order.
   * This will reduce the lexer loop times to optimize the performance.
   * Return a new action.
   */
  static reduce<
    DataBindings extends GeneralTokenDataBinding = never,
    ActionState = never,
    ErrorType = never,
  >(
    ...actions: IntoAction<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ActionState,
      ErrorType
    >[]
  ): Action<DataBindings, ActionState, ErrorType> {
    return (
      actions.map((a) => Action.from(a)) as Action<
        DataBindings,
        ActionState,
        ErrorType
      >[]
    ).reduce((a, b) => a.or(b));
  }

  /**
   * Set kinds for this action. This is used if your action can yield multiple kinds.
   * @example
   * builder.append(a => a.from(...).kinds(...).select(...))
   */
  kinds<NewKinds extends string>(
    ...kinds: NewKinds[]
  ): MultiKindsAction<
    {
      kind: NewKinds;
      data: DataBindings extends never
        ? undefined // ensure default data is undefined instead of never, #33
        : ExtractData<DataBindings>;
    },
    ActionState,
    ErrorType
  > {
    const _this = this as unknown as Action<
      {
        kind: NewKinds;
        data: DataBindings extends never
          ? undefined
          : ExtractData<DataBindings>;
      },
      ActionState,
      ErrorType
    >;
    const possibleKinds = _this.possibleKinds as Set<NewKinds>; // make mutable
    possibleKinds.clear();
    kinds.forEach((kind) => possibleKinds.add(kind));
    return new MultiKindsAction(_this);
  }

  /**
   * Set the kind and the data binding for this action.
   * Use this if your action can only yield one kind.
   */
  bind<NewKinds extends string>(
    s: NewKinds,
  ): Action<
    {
      kind: NewKinds;
      data: DataBindings extends never
        ? undefined // ensure default data is undefined instead of never, #33
        : ExtractData<DataBindings>;
    },
    ActionState,
    ErrorType
  > {
    return this.kinds(s).select(() => s);
  }

  /**
   * Map different kinds to different data.
   * This is used when your action can yield multiple kinds.
   * Return a new action.
   * @example
   * Action.from(...).kinds('a', 'b').select(...).map({
   *   a: ...,
   *   b: ...,
   * })
   */
  map<
    Mapper extends Record<
      ExtractKinds<DataBindings>,
      (
        ctx: AcceptedActionDecoratorContext<
          DataBindings,
          ActionState,
          ErrorType
        >,
      ) => unknown
    >,
  >(
    mapper: Mapper,
  ): Action<
    {
      [K in Extract<keyof Mapper, string>]: {
        kind: K;
        data: ReturnType<Mapper[K]>;
      };
    }[Extract<keyof Mapper, string>],
    ActionState,
    ErrorType
  > {
    return this.apply((ctx) => {
      const output = ctx.output as unknown as AcceptedActionOutput<
        ExtractKinds<DataBindings>,
        ExtractData<DataBindings>,
        ErrorType
      >;
      output.data = mapper[output.kind](ctx);
      return output;
    }) as unknown as Action<
      {
        [K in Extract<keyof Mapper, string>]: {
          kind: K;
          data: ReturnType<Mapper[K]>;
        };
      }[Extract<keyof Mapper, string>],
      ActionState,
      ErrorType
    >;
  }
}

export type ReadonlyAction<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = {
  readonly [K in
    | "exec"
    | "possibleKinds"
    | "maybeMuted"
    | "neverMuted"]: Action<DataBindings, ActionState, ErrorType>[K];
};
