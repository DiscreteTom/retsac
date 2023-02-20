export type LR_RuntimeErrorType = "MISSING_LEXER" | "MISSING_TRAVERSER";

export class LR_RuntimeError extends Error {
  type: LR_RuntimeErrorType;

  constructor(type: LR_RuntimeErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, LR_RuntimeError.prototype);
  }

  static missingLexerToParseLiteral() {
    return new LR_RuntimeError(
      "MISSING_LEXER",
      `Lexer is required to parse literal grammars`
    );
  }

  static traverserNotDefined() {
    return new LR_RuntimeError("MISSING_TRAVERSER", `Traverser is not defined`);
  }
}
