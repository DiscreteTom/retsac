/**
 * Bind token's kind with its data type.
 */
export type TokenDataBinding<Kinds extends string, Data> = {
  /**
   * User-defined token kind name.
   */
  kind: Kinds;
  /**
   * User-defined data stored in this token.
   */
  data: Data;
};

export type GeneralTokenDataBinding = TokenDataBinding<string, unknown>;

export type Range = {
  /**
   * 0-based index.
   */
  start: number;
  /**
   * 0-based index. Exclusive.
   */
  end: number;
};

/**
 * The output of a lexer.
 */
export type IToken<
  DataBindings extends GeneralTokenDataBinding,
  ErrorType,
> = Readonly<DataBindings> & {
  readonly buffer: string;
  readonly range: Readonly<Range>;
  /**
   * `undefined` means no error.
   */
  readonly error?: ErrorType;
  /**
   * Token's text content.
   */
  readonly content: string;
};

/**
 * The output of a lexer.
 */
export class Token<DataBindings extends GeneralTokenDataBinding, ErrorType> {
  kind: DataBindings["kind"];
  data: DataBindings["data"];
  buffer: string;
  range: Range;
  /**
   * `undefined` means no error.
   */
  error?: ErrorType;

  private constructor() {}

  static from<Kind extends string, Data, ErrorType>(
    kind: Kind,
    data: Data,
    buffer: string,
    range: Range,
    error?: ErrorType,
  ): IToken<{ kind: Kind; data: Data }, ErrorType> {
    const t = new Token<{ kind: Kind; data: Data }, ErrorType>();
    t.kind = kind;
    t.data = data;
    t.buffer = buffer;
    t.range = range;
    t.error = error;
    return t;
  }

  get content(): string {
    return this.buffer.slice(this.range.start, this.range.end);
  }
}

export type GeneralToken = IToken<GeneralTokenDataBinding, unknown>;
