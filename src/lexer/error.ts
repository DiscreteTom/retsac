export type LexerErrorType = "CARET_NOT_ALLOWED" | "INVALID_LENGTH_FOR_TAKE";

export class LexerError extends Error {
  type: LexerErrorType;
  constructor(type: LexerErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, LexerError.prototype);
  }
}

export class CaretNotAllowedError extends LexerError {
  constructor() {
    super(
      "CARET_NOT_ALLOWED",
      "Regex starts with '^' is not allowed when use regex to create actions." +
        "If this is intentional, use `Action.match(regex, { rejectCaret: false })` instead."
    );
  }
}

export class InvalidLengthForTakeError extends LexerError {
  constructor(public n: number) {
    super(
      "INVALID_LENGTH_FOR_TAKE",
      `Invalid length \`${n}\` for \`lexer.take\`, must be greater than 0.`
    );
  }
}
