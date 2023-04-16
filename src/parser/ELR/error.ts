export type LR_RuntimeErrorType = "INVALID_LITERAL";

export class LR_RuntimeError extends Error {
  type: LR_RuntimeErrorType;

  constructor(type: LR_RuntimeErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, LR_RuntimeError.prototype);
  }

  static invalidLiteral(content: string) {
    return new LR_RuntimeError(
      "INVALID_LITERAL",
      `Lexer can't transform '${content}' to a grammar type.`
    );
  }
}
