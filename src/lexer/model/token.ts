/** The output of a lexer. */
export type Token<ErrorType, Kinds extends string> = {
  /** User-defined token kind name. */
  kind: Kinds;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  error?: ErrorType;
};
