export enum ParserErrorType {
  NO_ENTRY_NT,
  UNDEFINED_GRAMMAR_SYMBOL,
  DUPLICATED_DEFINITION,
  UNDEFINED_ENTRY_NT,
  TOKENIZE_GRAMMAR_RULE_FAILED,
  EMPTY_RULE,
  EMPTY_LITERAL,
  CONFLICT,
  NO_SUCH_GRAMMAR_RULE,
  TOO_MANY_END_HANDLER,
}

export class ParserError extends Error {
  type: ParserErrorType;

  constructor(type: ParserErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, ParserError.prototype);
  }
}
