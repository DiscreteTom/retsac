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

/**
 * The output of a lexer.
 */
// TODO: helper type to extract token generic parameters
export type Token<
  Kinds extends string,
  Data,
  DataBindings extends TokenDataBinding<Kinds, Data>,
  ErrorType,
> = {
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
