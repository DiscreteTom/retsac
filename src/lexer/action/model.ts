// This has to be a class, since we need to cache the `rest` of the input.
export class AcceptedActionOutput<E> {
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
  readonly error?: E;
  /**
   * The content of the token, equals to `input.slice(start, start + digested)`.
   * This is not lazy since we need this to calculate `lexer.lineChars`.
   */
  readonly content: string;

  private _rest: string;

  constructor(
    data: Pick<
      AcceptedActionOutput<E>,
      "buffer" | "start" | "muted" | "digested" | "error"
    > & {
      // if ActionExec can yield the content/rest,
      // we can directly use them to prevent unnecessary calculation.
      content?: string; // TODO: make this required? since this class should not be directly used by user
      _rest?: string;
    }
  ) {
    this.accept = true;
    Object.assign(this, data);
    this.content ??= this.buffer.slice(this.start, this.start + this.digested);
  }

  // TODO: maybe change this into a non-static method?
  // e.g. `this.override`
  static from<E>(
    another: AcceptedActionOutput<E>,
    override: Partial<AcceptedActionOutput<E>> = {}
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

export type ActionOutput<E> =
  | Readonly<{ accept: false }>
  | AcceptedActionOutput<E>;

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

export type SimpleAcceptedActionOutput<E> = {
  /** Default: `false` */
  readonly muted?: boolean;
  readonly error?: E;
  readonly rest?: string;
} & (
  | // at least one of `digested` and `content` must be defined
  { digested: number; content?: string }
  | { digested?: number; content: string }
);
