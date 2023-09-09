import { Conflict, ConflictType, Grammar, GrammarRule } from "../model";
import { TempGrammarRule } from "./model";

export type ELR_BuilderErrorType =
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
  | "INVALID_LITERAL"
  | "TOO_MANY_END_HANDLER"
  | "NO_SUCH_CONFLICT"
  | "NO_RENAME_TARGET";

export class ELR_BuilderError extends Error {
  type: ELR_BuilderErrorType;

  constructor(type: ELR_BuilderErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ELR_BuilderError.prototype);
  }
}

export class GrammarRuleNotFoundError extends ELR_BuilderError {
  constructor(public gr: TempGrammarRule<any, any>) {
    super(
      "GRAMMAR_RULE_NOT_FOUND",
      `No such grammar rule: ${gr.toStringWithGrammarName()}`
    );
    Object.setPrototypeOf(this, GrammarRuleNotFoundError.prototype);
  }
}

export class NextGrammarNotFoundError extends ELR_BuilderError {
  constructor(public next: Grammar, public NT: string) {
    super(
      "NEXT_GRAMMAR_NOT_FOUND",
      `Next grammar ${next} not in follow set of ${NT}`
    );
    Object.setPrototypeOf(this, NextGrammarNotFoundError.prototype);
  }
}

export class ConflictError extends ELR_BuilderError {
  constructor(
    public reducerRule: GrammarRule<any, any>,
    public c: Conflict<any, any>
  ) {
    super(
      "CONFLICT",
      c.type == ConflictType.REDUCE_SHIFT
        ? `Unresolved R-S conflict (length: ${c.overlapped}, next: \`${c.next
            .map((g) => g.toString())
            .join(
              " "
            )}\`): ${reducerRule.toString()} | ${c.anotherRule.toString()}`
        : `Unresolved R-R conflict (${
            (c.handleEnd ? "end of input" : "") +
            (c.next.grammars.size > 0
              ? `${c.handleEnd ? ", " : ""}next: \`${c.next
                  .map((g) => g.toString())
                  .join(" ")}\``
              : "")
          }): ${reducerRule.toString()} | ${c.anotherRule.toString()}`
    );
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

export class UnknownEntryNTError extends ELR_BuilderError {
  constructor(public NT: string) {
    super("UNKNOWN_ENTRY_NT", `Undefined entry NT: "${NT}"`);
    Object.setPrototypeOf(this, UnknownEntryNTError.prototype);
  }
}

export class DuplicatedDefinitionError extends ELR_BuilderError {
  constructor(public name: string) {
    super(
      "DUPLICATED_DEFINITION",
      `Duplicated definition for grammar symbol: ${name}`
    );
    Object.setPrototypeOf(this, DuplicatedDefinitionError.prototype);
  }
}

export class UnknownGrammarError extends ELR_BuilderError {
  constructor(public name: string) {
    super("UNKNOWN_GRAMMAR", `Undefined grammar symbol: ${name}`);
    Object.setPrototypeOf(this, UnknownGrammarError.prototype);
  }
}

export class NoEntryNTError extends ELR_BuilderError {
  constructor() {
    super("NO_ENTRY_NT", `Entry NT is required for LR Parsers`);
    Object.setPrototypeOf(this, NoEntryNTError.prototype);
  }
}

export class TokenizeGrammarRuleFailedError extends ELR_BuilderError {
  constructor(public rule: string, public rest: string) {
    super(
      "TOKENIZE_GRAMMAR_RULE_FAILED",
      `Unable to tokenize: "${rest}" in grammar rule: "${rule}"`
    );
    Object.setPrototypeOf(this, TokenizeGrammarRuleFailedError.prototype);
  }
}

export class EmptyRuleError extends ELR_BuilderError {
  constructor(public NT: string, public rule: string) {
    super("EMPTY_RULE", `Empty rule: "${NT} <= ${rule}"`);
    Object.setPrototypeOf(this, EmptyRuleError.prototype);
  }
}

export class EmptyLiteralError extends ELR_BuilderError {
  constructor(public NT: string, public rule: string) {
    super("EMPTY_LITERAL", `Empty literal: "${NT} <= ${rule}"`);
    Object.setPrototypeOf(this, EmptyLiteralError.prototype);
  }
}

export class TooManyEndHandlerError extends ELR_BuilderError {
  constructor(public rule: GrammarRule<any, any>) {
    super(
      "TOO_MANY_END_HANDLER",
      `Too many end handlers for rule ${rule.toString()}`
    );
    Object.setPrototypeOf(this, TooManyEndHandlerError.prototype);
  }
}

export class NoSuchConflictError extends ELR_BuilderError {
  constructor(
    public reducerRule: GrammarRule<any, any>,
    public anotherRule: GrammarRule<any, any>,
    public conflictType: ConflictType,
    public next: Grammar[],
    public handleEnd: boolean
  ) {
    super(
      "NO_SUCH_CONFLICT",
      `No such ${
        conflictType == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
      } conflict: ${reducerRule.toString()} | ${anotherRule.toString()}` +
        (next.length > 0
          ? ` next: ${next.map((n) => n.toString()).join(",")}`
          : "") +
        (handleEnd ? " end of input" : "")
    );
    Object.setPrototypeOf(this, NoSuchConflictError.prototype);
  }
}

export class InvalidLiteralError extends ELR_BuilderError {
  constructor(public literal: string) {
    super("INVALID_LITERAL", `Invalid literal: '${literal}'`);
    Object.setPrototypeOf(this, InvalidLiteralError.prototype);
  }
}

export class NoRenameTargetError extends ELR_BuilderError {
  constructor(public def: string | string[], public rename: string) {
    super(
      "NO_RENAME_TARGET",
      `No rename target in rule ${def} for rename ${rename}`
    );
    Object.setPrototypeOf(this, NoRenameTargetError.prototype);
  }
}
