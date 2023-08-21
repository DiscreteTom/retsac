export class AcceptedActionOutput {
  /** This action can accept some input as a token. */
  readonly accept: true;
  /** The whole input string. */
  readonly buffer: string;
  /** From where to lex. */
  readonly start: number;
  /** Don't emit token, continue lex. */
  readonly muted: boolean;
  /** How many chars are accepted by this action. */
  readonly digested: number;
  /** Accept, but set an error to mark this token. */
  readonly error?: any; // TODO: use generic type?
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  readonly content: string;

  private _rest: string;

  constructor(
    data: Pick<
      AcceptedActionOutput,
      "buffer" | "start" | "muted" | "digested" | "error"
    > & {
      // if ActionExec can yield the content/rest,
      // we can directly use them to prevent unnecessary calculation.
      content?: string;
      _rest?: string;
    }
  ) {
    this.accept = true;
    Object.assign(this, data);
    this.content ??= this.buffer.slice(this.start, this.start + this.digested);
  }

  static from(
    another: AcceptedActionOutput,
    override: Partial<AcceptedActionOutput> = {}
  ) {
    return new AcceptedActionOutput({ ...another, ...override });
  }

  /**
   * The rest of the input, equals to `input.slice(start + digested)`.
   * This is lazy and cached.
   */
  get rest() {
    return (
      this._rest ?? (this._rest = this.buffer.slice(this.start + this.digested))
    );
  }
}

export type ActionOutput = Readonly<{ accept: false }> | AcceptedActionOutput;

export class ActionInput {
  /** The whole input string. */
  readonly buffer: string;
  /** From where to lex. */
  readonly start: number;
  private _rest?: string;

  constructor(data: Pick<ActionInput, "buffer" | "start">) {
    Object.assign(this, data);
  }

  /**
   * The rest of the input, equals to `input.slice(start)`.
   * This is lazy and cached.
   */
  get rest() {
    return this._rest ?? (this._rest = this.buffer.slice(this.start));
  }
}

export type ActionExec = (input: ActionInput) => ActionOutput;

export type SimpleAcceptedActionOutput = {
  /** Default: `false` */
  readonly muted?: boolean;
  readonly error?: any; // TODO: use generic type?
  readonly rest?: string;
} & (
  | { digested: number; content?: string }
  | { digested?: number; content: string }
);

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
       * Auto add the sticky flag to the regex.
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
      if (!r.sticky)
        // make sure r has the flag 'y' so we can use `r.lastIndex` to reset state.
        r = new RegExp(r.source, r.flags + "y");
    }
    if (options?.rejectCaret ?? true) {
      if (r.source.startsWith("^"))
        throw new Error("regex starts with '^' is not allowed"); // TODO: use typed error
    }

    // use `new Action` instead of `Action.simple` to re-use the `res[0]`
    return new Action((input) => {
      r.lastIndex = input.start;
      const res = r.exec(input.buffer);
      if (res && res.index != -1)
        return new AcceptedActionOutput({
          muted: false,
          digested: res.index + res[0].length,
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
