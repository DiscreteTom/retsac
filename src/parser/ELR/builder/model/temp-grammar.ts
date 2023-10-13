import type { IReadonlyLexerCore } from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { Traverser } from "../../../traverser";
import { StringCache } from "../../../cache";
import type { Callback, Condition, Grammar, GrammarRepo } from "../../model";
import { InvalidLiteralError } from "../error";

/**
 * Grammar type, but can't distinguish N or NT.
 */
export enum TempGrammarType {
  LITERAL,
  /**
   * For T/NT.
   */
  GRAMMAR,
}

/**
 * Grammar, but can't distinguish N or NT.
 */
export class TempGrammar {
  readonly type: TempGrammarType;
  /**
   * Literal content(without quote), or T/NT's type name.
   */
  readonly content: string;
  /**
   * The name of the grammar.
   * If user give this grammar a name, this is not `undefined`, otherwise `undefined`.
   */
  readonly name?: string;

  readonly strWithGrammarName: StringCache;

  constructor(p: Pick<TempGrammar, "type" | "content" | "name">) {
    this.type = p.type;
    this.content = p.content;
    this.name = p.name;

    this.strWithGrammarName = new StringCache(() =>
      this.toGrammarStringWithName(),
    );
  }

  toGrammar<
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
    LexerActionState,
  >(
    repo: GrammarRepo<Kinds, LexerKinds>,
    /**
     * Lexer is required to lex the literal grammar's kind name.
     */
    lexer: IReadonlyLexerCore<LexerError, LexerKinds, LexerActionState>,
    printAll: boolean,
    logger: Logger,
    isNT = true,
  ) {
    if (this.type == TempGrammarType.LITERAL) {
      const { token } = lexer.dryClone().lex(this.content);
      if (token == null) {
        // for un-lexable literal, throw error instead of using anonymous type
        // this is to prevent mis-writing literal grammar
        const e = new InvalidLiteralError(this.content);
        if (printAll) logger.log({ entity: "Parser", message: e.message });
        else throw e;
      }
      return repo.Literal(
        this.content,
        token?.kind ?? ("" as LexerKinds), // this null check is for printAll
        this.name,
      ) as Grammar<Kinds | LexerKinds>;
    }

    return (
      isNT
        ? repo.NT(this.content as Kinds, this.name)
        : repo.T(this.content as LexerKinds, this.name)
    ) as Grammar<Kinds | LexerKinds>;
  }

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * The output format should be the same as `Grammar.toStringWithName`.
   */
  private toGrammarStringWithName() {
    return this.type == TempGrammarType.LITERAL
      ? JSON.stringify(this.content) +
          (this.name == undefined ? "" : "@" + this.name)
      : this.content +
          (this.name == undefined || this.name == this.content
            ? ""
            : "@" + this.name);
  }
}

/**
 * Grammar rule, but can't distinguish N or NT.
 */
export class TempGrammarRule<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> {
  readonly rule: readonly TempGrammar[];
  /**
   * The reduce target.
   */
  readonly NT: Kinds;
  callback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  rejecter?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  commit?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  traverser?: Traverser<ASTData, ErrorType, Kinds | LexerKinds>;
  readonly hydrationId: number;
  readonly strWithGrammarName: StringCache;

  constructor(
    data: Pick<
      TempGrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >,
      | "rule"
      | "NT"
      | "commit"
      | "callback"
      | "rejecter"
      | "rollback"
      | "traverser"
      | "hydrationId"
    >,
  ) {
    this.rule = data.rule;
    this.NT = data.NT;
    this.commit = data.commit;
    this.callback = data.callback;
    this.rejecter = data.rejecter;
    this.rollback = data.rollback;
    this.traverser = data.traverser;
    this.hydrationId = data.hydrationId;

    this.strWithGrammarName = new StringCache(() =>
      this.toStringWithGrammarName(),
    );
  }

  /**
   * Return ``{ NT: `grammar rules` }``.
   * Grammar's name is included.
   * This should yield the same output format as `GrammarRule.toStringWithGrammarName`.
   */
  private toStringWithGrammarName() {
    return `{ ${this.NT}: \`${this.rule
      .map((g) => g.strWithGrammarName.value)
      .join(" ")}\` }`;
  }
}
