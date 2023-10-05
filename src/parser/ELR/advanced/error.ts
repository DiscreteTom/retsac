import type { GrammarSet } from "../model";

export type LR_AdvancedBuilderErrorType =
  | "INVALID_GRAMMAR_RULE"
  | "INVALID_PLACEHOLDER_FOLLOW";

export class LR_AdvancedBuilderError extends Error {
  type: LR_AdvancedBuilderErrorType;
  constructor(type: LR_AdvancedBuilderErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, LR_AdvancedBuilderError.prototype);
  }
}

export class InvalidGrammarRuleError extends LR_AdvancedBuilderError {
  constructor(
    public gr: string,
    public rest: string,
  ) {
    super(
      "INVALID_GRAMMAR_RULE",
      `Invalid grammar rule: \`${gr}\`, rest: \`${rest}\``,
    );
    Object.setPrototypeOf(this, InvalidGrammarRuleError.prototype);
  }
}

export class InvalidPlaceholderFollowError<
  Kinds extends string,
  LexerKinds extends string,
> extends LR_AdvancedBuilderError {
  constructor(
    public placeholderNT: string,
    public grammarSnippet: string,
    public follows: GrammarSet<Kinds, LexerKinds>,
  ) {
    super(
      "INVALID_PLACEHOLDER_FOLLOW",
      `Placeholder rule { ${placeholderNT} := \`${grammarSnippet}\` } has invalid follow: ${follows
        .map((g) => g.grammarStrWithoutName.value)
        .join(
          ", ",
        )}. You can modify your grammar rule or use reParse to fix this. See https://github.com/DiscreteTom/retsac/issues/22 for more details.`,
    );
    Object.setPrototypeOf(this, InvalidPlaceholderFollowError.prototype);
  }
}
