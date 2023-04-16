export type ParserTraverseErrorType = "MISSING_TRAVERSER";

export class ParserTraverseError extends Error {
  type: ParserTraverseErrorType;

  constructor(type: ParserTraverseErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, ParserTraverseError.prototype);
  }

  static traverserNotDefined() {
    return new ParserTraverseError(
      "MISSING_TRAVERSER",
      `Traverser is not defined`
    );
  }
}
