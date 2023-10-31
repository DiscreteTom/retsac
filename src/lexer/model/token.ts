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

/**
 * The output of a lexer.
 */
export type Token<DataBindings extends GeneralTokenDataBinding, ErrorType> = {
  /**
   * Token's text content.
   */
  content: string;
  /**
   * Index of the first char of this token in the whole input string.
   */
  start: number;
  /**
   * `undefined` means no error.
   */
  error?: ErrorType;
} & DataBindings;

export type GeneralToken = Token<GeneralTokenDataBinding, unknown>;
