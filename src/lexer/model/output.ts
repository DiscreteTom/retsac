export type ILexOutput<TokenType> = {
  /**
   * `undefined` if no actions can be accepted or all muted.
   */
  token: TokenType | undefined;
  /**
   * How many chars are digested during this lex.
   * Zero if no actions can be accepted.
   * This might be non-zero even the `token` is `undefined`,
   * since there might be some muted actions are accepted.
   */
  digested: number;
  /**
   * Not `undefined` if the last action's output contains a rest.
   */
  rest: string | undefined;
  /**
   * Accumulated errors during this lex.
   */
  errors: TokenType[];
};

export type ILexAllOutput<TokenType> = {
  tokens: TokenType[];
} & Pick<ILexOutput<TokenType>, "digested" | "errors" | "rest">;

export type IPeekOutput<TokenType, ActionState> = {
  actionState: ActionState;
} & ILexOutput<TokenType>;

export type ITrimOutput<TokenType> = Pick<
  ILexOutput<TokenType>,
  "digested" | "errors" | "rest"
>;
