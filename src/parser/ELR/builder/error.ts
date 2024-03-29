import type { ExtractKinds, GeneralTokenDataBinding } from "../../../lexer";
import type { Conflict, Grammar } from "../model";
import { ConflictType, GrammarRule } from "../model";
import type { TempGrammarRule } from "./model";

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
  | "NO_RENAME_TARGET"
  | "ROLLBACK_DEFINED_WHILE_NOT_ENABLED"
  | "HYDRATE_HASH_MISMATCH";

export class ELR_BuilderError extends Error {
  type: ELR_BuilderErrorType;

  constructor(type: ELR_BuilderErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ELR_BuilderError.prototype);
  }
}

export class GrammarRuleNotFoundError<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> extends ELR_BuilderError {
  constructor(
    public gr: TempGrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    super(
      "GRAMMAR_RULE_NOT_FOUND",
      `No such grammar rule: ${GrammarRule.getGrammarRuleString(gr)}`,
    );
    Object.setPrototypeOf(this, GrammarRuleNotFoundError.prototype);
  }
}

export class NextGrammarNotFoundError<
  AllNTs extends string,
> extends ELR_BuilderError {
  constructor(
    public next: Grammar<AllNTs>,
    public NT: string,
  ) {
    super(
      "NEXT_GRAMMAR_NOT_FOUND",
      `Next grammar ${next} not in follow set of ${NT}`,
    );
    Object.setPrototypeOf(this, NextGrammarNotFoundError.prototype);
  }
}

export class ConflictError<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> extends ELR_BuilderError {
  constructor(
    public reducerRule: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    public c: Conflict<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    super(
      "CONFLICT",
      c.type === ConflictType.REDUCE_SHIFT
        ? `Unresolved R-S conflict: ${reducerRule.toString()} vs ${c.anotherRule.toString()}, next: \`${c.next
            .map((g) => g.toString())
            .join(" ")}\``
        : `Unresolved R-R conflict: ${reducerRule.toString()} vs ${c.anotherRule.toString()}, ${
            (c.handleEnd ? "end of input" : "") +
            (c.next.grammars.size > 0
              ? `${c.handleEnd ? ", " : ""}next: \`${c.next
                  .map((g) => g.toString())
                  .join(" ")}\``
              : "")
          }`,
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
      `Duplicated definition for grammar symbol: ${name}`,
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
  constructor(
    public rule: string,
    public rest: string,
  ) {
    super(
      "TOKENIZE_GRAMMAR_RULE_FAILED",
      `Unable to tokenize: "${rest}" in grammar rule: "${rule}"`,
    );
    Object.setPrototypeOf(this, TokenizeGrammarRuleFailedError.prototype);
  }
}

export class EmptyRuleError extends ELR_BuilderError {
  constructor(public NT: string) {
    super("EMPTY_RULE", `Empty rule for NT: ${NT}`);
    Object.setPrototypeOf(this, EmptyRuleError.prototype);
  }
}

export class EmptyLiteralError extends ELR_BuilderError {
  constructor(
    public NT: string,
    public rule: string,
  ) {
    super("EMPTY_LITERAL", `Empty literal: "${NT} := ${rule}"`);
    Object.setPrototypeOf(this, EmptyLiteralError.prototype);
  }
}

export class TooManyEndHandlerError<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> extends ELR_BuilderError {
  constructor(
    public rule: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    super(
      "TOO_MANY_END_HANDLER",
      `Too many end handlers for rule ${rule.toString()}`,
    );
    Object.setPrototypeOf(this, TooManyEndHandlerError.prototype);
  }
}

export class NoSuchConflictError<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> extends ELR_BuilderError {
  constructor(
    public reducerRule: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    public anotherRule: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    public conflictType: ConflictType,
    public next: Grammar<NTs | ExtractKinds<LexerDataBindings>>[],
    public handleEnd: boolean,
  ) {
    super(
      "NO_SUCH_CONFLICT",
      `No such ${
        conflictType === ConflictType.REDUCE_SHIFT ? "RS" : "RR"
      } conflict: ${reducerRule.toString()} | ${anotherRule.toString()}` +
        (next.length > 0
          ? ` next: ${next.map((n) => n.toString()).join(",")}`
          : "") +
        (handleEnd ? " end of input" : ""),
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
  constructor(
    public def: string | string[],
    public rename: string,
  ) {
    super(
      "NO_RENAME_TARGET",
      `No rename target in rule ${def} for rename ${rename}`,
    );
    Object.setPrototypeOf(this, NoRenameTargetError.prototype);
  }
}

export class RollbackDefinedWhileNotEnabledError<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> extends ELR_BuilderError {
  constructor(
    public rule: GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ) {
    super(
      "ROLLBACK_DEFINED_WHILE_NOT_ENABLED",
      `Rollback defined in the grammar rule while parser's rollback is not enabled: ${rule.toString()}. ` +
        `To enable rollback, set the rollback option to true when build the parser.`,
    );
    Object.setPrototypeOf(this, RollbackDefinedWhileNotEnabledError.prototype);
  }
}

export class HydrateHashMismatchError extends ELR_BuilderError {
  constructor() {
    super(
      "HYDRATE_HASH_MISMATCH",
      `Hydrate hash mismatch. Please rebuild the serializable parser data.`,
    );
    Object.setPrototypeOf(this, HydrateHashMismatchError.prototype);
  }
}
