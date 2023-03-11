export type LR_AdvancedBuilderErrorType = "INVALID_GRAMMAR_RULE";

export class LR_AdvancedBuilderError extends Error {
  type: LR_AdvancedBuilderErrorType;

  constructor(type: LR_AdvancedBuilderErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, LR_AdvancedBuilderError.prototype);
  }

  static invalidGrammarRule(gr: string) {
    return new LR_AdvancedBuilderError(
      "INVALID_GRAMMAR_RULE",
      `Invalid grammar rule for advanced parser: \`${gr}\``
    );
  }
}
