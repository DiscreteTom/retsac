import { BaseParserContext } from "../model";
import { Conflict, ConflictType } from "./model";
import { TempGrammar, TempGrammarRule } from "./temp-grammar";

export type LR_BuilderErrorType =
  | "GRAMMAR_RULE_NOT_FOUND"
  | "NEXT_GRAMMAR_NOT_FOUND"
  | "CONFLICT"
  | "UNKNOWN_ENTRY_NT"
  | "DUPLICATED_DEFINITION"
  | "UNKNOWN_GRAMMAR"
  | "NO_ENTRY_NT"
  | "TOKENIZE_GRAMMAR_RULE_FAILED"
  | "EMPTY_RULE"
  | "EMPTY_LITERAL"
  | "TOO_MANY_END_HANDLER"
  | "NO_SUCH_CONFLICT";

export class LR_BuilderError extends Error {
  type: LR_BuilderErrorType;

  constructor(type: LR_BuilderErrorType, msg: string) {
    super(msg);

    this.type = type;

    Object.setPrototypeOf(this, LR_BuilderError.prototype);
  }

  static grammarRuleNotFound<T, After, Ctx extends BaseParserContext<T, After>>(
    gr: TempGrammarRule<T, After, Ctx>
  ) {
    return new LR_BuilderError(
      "GRAMMAR_RULE_NOT_FOUND",
      `No such grammar rule: ${gr.toString()}`
    );
  }

  static nextGrammarNotFound(next: TempGrammar, NT: string) {
    return new LR_BuilderError(
      "NEXT_GRAMMAR_NOT_FOUND",
      `Next grammar ${next.toString()} not in follow set of ${NT}`
    );
  }

  static conflict<T, After, Ctx extends BaseParserContext<T, After>>(
    c: Conflict<T, After, Ctx>
  ) {
    return new LR_BuilderError(
      "CONFLICT",
      c.type == ConflictType.REDUCE_SHIFT
        ? `Unresolved R-S conflict (length: ${c.length}, next: \`${c.next
            .map((g) => g.toString())
            .join(
              " "
            )}\`): ${c.reducerRule.toString()} | ${c.anotherRule.toString()}`
        : `Unresolved R-R conflict (${
            (c.handleEnd ? "end of input" : "") +
            (c.next.length > 0
              ? `${c.handleEnd ? ", " : ""}next: \`${c.next
                  .map((g) => g.toString())
                  .join(" ")}\``
              : "")
          }): ${c.reducerRule.toString()} | ${c.anotherRule.toString()}`
    );
  }

  static unknownEntryNT(NT: string) {
    return new LR_BuilderError(
      "UNKNOWN_ENTRY_NT",
      `Undefined entry NT: "${NT}"`
    );
  }

  static duplicatedDefinition(name: string) {
    return new LR_BuilderError(
      "DUPLICATED_DEFINITION",
      `Duplicated definition for grammar symbol: ${name}`
    );
  }

  static unknownGrammar(name: string) {
    return new LR_BuilderError(
      "UNKNOWN_GRAMMAR",
      `Undefined grammar symbol: ${name}`
    );
  }

  static noEntryNT() {
    return new LR_BuilderError(
      "NO_ENTRY_NT",
      `Entry NT is required for LR Parser`
    );
  }

  static tokenizeGrammarRuleFailed(rule: string, rest: string) {
    return new LR_BuilderError(
      "TOKENIZE_GRAMMAR_RULE_FAILED",
      `Unable to tokenize: "${rest}" in grammar rule: "${rule}"`
    );
  }

  static emptyRule(NT: string, rule: string) {
    return new LR_BuilderError("EMPTY_RULE", `Empty rule: "${NT} <= ${rule}"`);
  }

  static emptyLiteral(NT: string, rule: string) {
    return new LR_BuilderError(
      "EMPTY_LITERAL",
      `Empty literal: "${NT} <= ${rule}"`
    );
  }

  static tooManyEndHandler<T, After, Ctx extends BaseParserContext<T, After>>(
    rule: TempGrammarRule<T, After, Ctx>
  ) {
    return new LR_BuilderError(
      "TOO_MANY_END_HANDLER",
      `Too many end handlers for rule ${rule.toString()}`
    );
  }

  static noSuchConflict<T, After, Ctx extends BaseParserContext<T, After>>(
    reducerRule: TempGrammarRule<T, After, Ctx>,
    anotherRule: TempGrammarRule<T, After, Ctx>,
    type: ConflictType,
    next: TempGrammar[],
    handleEnd: boolean
  ) {
    return new LR_BuilderError(
      "NO_SUCH_CONFLICT",
      `No such ${
        type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
      } conflict: ${reducerRule.toString()} | ${anotherRule.toString()}` +
        (next.length > 0
          ? ` next: ${next.map((n) => n.toGrammar().toString()).join(",")}`
          : "") +
        (handleEnd ? " end of input" : "")
    );
  }
}