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

export type SimpleAcceptedActionOutput = {
  /** Default: `false` */
  readonly muted?: boolean;
  readonly error?: any; // TODO: use generic type?
  readonly rest?: string;
} & (
  | { digested: number; content?: string }
  | { digested?: number; content: string }
);
