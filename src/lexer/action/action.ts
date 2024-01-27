import type {
  ExtractData,
  ExtractKinds,
  GeneralTokenDataBinding,
} from "../model";
import type { ActionInput } from "./input";
import type {
  ActionOutput,
  SimpleActionOutputWithoutKind,
  ActionOutputWithoutKind,
} from "./output";
import { EnhancedActionOutput } from "./output";
import { MultiKindAction } from "./select";
import { checkRegexNotStartsWithCaret, makeRegexAutoSticky } from "./utils";

/**
 * User defined action execution function.
 */
export type ActionExec<Kinds extends string, Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionOutput<Kinds, Data, ErrorType> | undefined;

export type ActionExecWithoutKind<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => ActionOutputWithoutKind<Data, ErrorType> | undefined;

/**
 * If return a number, the number is how many chars are digested. If the number <= 0, reject.
 *
 * If return a SimpleAcceptedActionExecOutput, missing fields will be filled automatically.
 *
 * If return `undefined`, the action is rejected.
 */
export type SimpleActionExecWithoutKind<Data, ActionState, ErrorType> = (
  input: Readonly<ActionInput<ActionState>>,
) => number | SimpleActionOutputWithoutKind<Data, ErrorType> | undefined;

/**
 * These types can be transformed into an `Action` by {@link Action.from}.
 */
export type IntoAction<Kinds extends string, Data, ActionState, ErrorType> =
  | RegExp
  | Action<{ kind: Kinds; data: Data }, ActionState, ErrorType>
  | SimpleActionExecWithoutKind<Data, ActionState, ErrorType>;

export type AcceptedActionDecoratorContext<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = {
  readonly input: Readonly<ActionInput<ActionState>>;
  readonly output: EnhancedActionOutput<
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
) =>
  | ActionOutput<NewDataBindings["kind"], NewDataBindings["data"], NewErrorType>
  | undefined;

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
  readonly exec: ActionExec<
    DataBindings["kind"],
    DataBindings["data"],
    ActionState,
    ErrorType
  >;
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
   * because we want to make sure the possible kinds is correct.
   *
   * So for most cases, use {@link Action.exec} as a substitute.
   */
  private constructor(
    exec: ActionExec<
      DataBindings["kind"],
      DataBindings["data"],
      ActionState,
      ErrorType
    >,
    maybeMuted: boolean,
    possibleKinds: ReadonlySet<ExtractKinds<DataBindings>>,
  ) {
    this.exec = exec;
    this.maybeMuted = maybeMuted;
    this.possibleKinds = possibleKinds;
  }

  /**
   * Create an `Action` from `ActionExec`.
   * This should be treat as the public constructor of `Action`.
   */
  static exec<Data = undefined, ActionState = never, ErrorType = never>(
    exec: ActionExecWithoutKind<Data, ActionState, ErrorType>,
    options?: Partial<
      Pick<Action<never, ActionState, ErrorType>, "maybeMuted">
    >,
  ): Action<
    {
      // kind should be set later by `kinds` or `bind`
      kind: never;
      data: Data;
    },
    ActionState,
    ErrorType
  > {
    return new Action(
      (input) => {
        const output = exec(input);
        if (output === undefined) return undefined;
        return {
          kind: undefined as never,
          ...output,
        };
      },
      options?.maybeMuted ?? false,
      new Set(),
    );
  }

  /**
   * Create an `Action` from `SimpleActionExec`.
   */
  static simple<Data = undefined, ActionState = never, ErrorType = never>(
    f: SimpleActionExecWithoutKind<Data, ActionState, ErrorType>,
  ): Action<
    {
      // Action constructed with `simple` has no kind
      kind: never;
      data: Data;
    },
    ActionState,
    ErrorType
  > {
    return Action.exec((input) => {
      const res = f(input);

      // if javascript support real function overload
      // we can move this type check out of the action's exec
      // to optimize performance
      if (res === undefined)
        // reject
        return undefined;
      if (typeof res === "number") {
        if (res <= 0) return undefined;
        return {
          data: undefined,
          digested: res,
          muted: false,
        } as ActionOutput<never, Data, ErrorType>;
      }
      // else, res is SimpleActionOutputWithoutKind
      if (res.digested <= 0) return undefined;
      return {
        data: res.data,
        digested: res.digested,
        muted: res.muted ?? false,
        error: res.error,
        rest: res.rest,
      } as ActionOutput<never, Data, ErrorType>;
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

    return Action.exec((input) => {
      // javascript doesn't have a string view
      // so we use r.lastIndex to run the regex from the start position
      r.lastIndex = input.start;
      const res = r.exec(input.buffer);
      if (res && res.index !== -1)
        return {
          data: res,
          digested: res[0].length,
          muted: false,
        };
      return undefined;
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
   * Create an `Action` from `RegExp`/`Action`/`SimpleActionExec`.
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
      ? // The result of `dryMatch` should be Action<{kind: never, data: undefined}, ActionState, ErrorType>
        // but when `r` is `RegExp` the `Kinds` is `never` and the `Data` is `undefined`
        // so its ok to cast the result to Action<{ kind: Kinds; data: Data }, ActionState, ErrorType>
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
   * Check the `ActionInput` before the action is executed.
   * Reject the action if the `condition` returns `true`.
   * Return a new action.
   */
  prevent(
    rejecter: (input: Readonly<ActionInput<ActionState>>) => boolean,
  ): Action<DataBindings, ActionState, ErrorType> {
    const exec = this.exec;

    return new Action(
      (input) => (rejecter(input) ? undefined : exec(input)),
      this.maybeMuted,
      this.possibleKinds,
    );
  }

  /**
   * Apply a decorator to this action.
   * Usually used to modify the `ActionOutput`.
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
    const exec = this.exec;
    return new Action(
      (input) => {
        const output = exec(input);
        if (output === undefined) return undefined;
        return decorator({
          input,
          output: EnhancedActionOutput.from(input, output),
        });
      },
      optionsOverride?.maybeMuted ?? this.maybeMuted,
      // apply won't change the kinds, only may change data bindings
      // so the possible kinds should be the same
      this.possibleKinds as ReadonlySet<ExtractKinds<NewDataBindings>>,
    );
  }

  /**
   * Set {@link ActionOutput.muted} if the action is accepted.
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
          ctx.output.raw.muted = muted;
          return ctx.output.raw;
        },
        { maybeMuted: muted },
      );
    } else {
      // muted is a function
      return this.apply(
        (ctx) => {
          ctx.output.raw.muted = muted(ctx);
          return ctx.output.raw;
        },
        // if muted is a function, we can't know whether the output will be muted
        // so we set maybeMuted to true
        { maybeMuted: true },
      );
    }
  }

  /**
   * Set {@link ActionOutput.error} if the action is accepted.
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
      const output = ctx.output.raw as unknown as ActionOutput<
        ExtractKinds<DataBindings>,
        ExtractData<DataBindings>,
        NewErrorType
      >;
      output.error = condition(ctx);
      return output;
    });
  }

  /**
   * Set {@link ActionOutput.error} if the action is accepted.
   * Return a new action.
   */
  error<NewErrorType>(
    error: NewErrorType,
  ): Action<DataBindings, ActionState, NewErrorType> {
    return this.check(() => error);
  }

  /**
   * Set {@link ActionOutput.data} if the action is accepted.
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
      const output = ctx.output.raw as unknown as ActionOutput<
        ExtractKinds<DataBindings>,
        NewData,
        ErrorType
      >;
      output.data = factory(ctx);
      return output;
    });
  }

  /**
   * Set {@link ActionOutput.data} to `undefined` if the action is accepted.
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
   * Reject the action if the condition is met.
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
    const rejecterFn =
      typeof rejecter === "boolean" ? () => rejecter : rejecter;

    return this.apply((ctx) => {
      if (rejecterFn(ctx)) return undefined;
      return ctx.output.raw;
    });
  }

  /**
   * Call `f` if the action is accepted.
   * Return a new action.
   */
  then(
    cb: (
      ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
    ) => void,
  ): Action<DataBindings, ActionState, ErrorType> {
    return this.apply((ctx) => {
      cb(ctx);
      return ctx.output.raw;
    });
  }

  /**
   * Execute another action if current action can't be accepted.
   * Return a new action.
   */
  or(
    another: IntoAction<
      ExtractKinds<DataBindings>,
      ExtractData<DataBindings>,
      ActionState,
      ErrorType
    >,
  ): Action<DataBindings, ActionState, ErrorType> {
    const exec = this.exec;
    const other = Action.from(another);
    const otherExec = other.exec;
    return new Action(
      (input) => {
        const output = exec(input);
        if (output !== undefined) return output;
        return otherExec(input);
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
  ): MultiKindAction<
    // since we are setting kinds, the DataBindings must be set even it's `never`
    {
      kind: NewKinds;
      data: [DataBindings] extends [never]
        ? undefined // ensure default data is undefined instead of never, #33
        : ExtractData<DataBindings>;
    },
    ActionState,
    ErrorType
  > {
    const _this = this as unknown as Action<
      {
        kind: NewKinds;
        data: [DataBindings] extends [never]
          ? undefined
          : ExtractData<DataBindings>;
      },
      ActionState,
      ErrorType
    >;
    const possibleKinds = _this.possibleKinds as Set<NewKinds>; // make mutable
    possibleKinds.clear();
    kinds.forEach((kind) => possibleKinds.add(kind));
    return new MultiKindAction(_this);
  }

  /**
   * Set the kind and the data binding for this action.
   * Use this if your action can only yield one kind.
   */
  bind<NewKinds extends string>(
    s: NewKinds,
  ): Action<
    // since we are setting kinds, the DataBindings must be set even it's `never`
    {
      kind: NewKinds;
      data: [DataBindings] extends [never]
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
      const output = ctx.output.raw as unknown as ActionOutput<
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
> = Readonly<
  Pick<
    Action<DataBindings, ActionState, ErrorType>,
    "exec" | "possibleKinds" | "maybeMuted" | "neverMuted"
  >
>;
