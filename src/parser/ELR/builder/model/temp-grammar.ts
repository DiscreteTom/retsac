import { ILexer } from "../../../../lexer";
import { Traverser } from "../../../ast";
import { Callback, Condition, GrammarRepo } from "../../model";

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

  constructor(p: Pick<TempGrammar, "type" | "content" | "name">) {
    this.type = p.type;
    this.content = p.content;
    this.name = p.name;
  }

  toGrammar(
    repo: GrammarRepo,
    /**
     * Lexer is required to lex the literal grammar's kind name.
     */
    lexer: Readonly<ILexer<any, any>>,
    isNT = true
  ) {
    if (this.type == TempGrammarType.LITERAL) {
      const token = lexer.dryClone().lex(this.content);
      if (token == null) {
        // TODO: printAll
        // TODO: for un-lexable literal, use anonymous type?
        throw new Error(`Can't lex literal \`${this.content}\``);
      }
      return repo.Literal(this.content, token.kind, this.name);
    }

    return isNT
      ? repo.NT(this.content, this.name)
      : repo.T(this.content, this.name);
  }

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * The output format should be the same as `Grammar.toStringWithName`.
   */
  toGrammarStringWithName() {
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
export class TempGrammarRule<ASTData, Kinds extends string> {
  readonly rule: readonly TempGrammar[];
  /**
   * The reduce target.
   */
  readonly NT: Kinds;
  callback?: Callback<ASTData, Kinds>;
  rejecter?: Condition<ASTData, Kinds>;
  rollback?: Callback<ASTData, Kinds>;
  commit?: Condition<ASTData, Kinds>;
  traverser?: Traverser<ASTData, Kinds>;

  constructor(
    data: Pick<
      TempGrammarRule<ASTData, Kinds>,
      | "rule"
      | "NT"
      | "commit"
      | "callback"
      | "rejecter"
      | "rollback"
      | "traverser"
    >
  ) {
    this.rule = data.rule;
    this.NT = data.NT;
    this.commit = data.commit;
    this.callback = data.callback;
    this.rejecter = data.rejecter;
    this.rollback = data.rollback;
    this.traverser = data.traverser;
  }

  /**
   * Return ``{ NT: `grammar rules` }``.
   * Grammar's name is included.
   * This should yield the same output format as `GrammarRule.toStringWithGrammarName`.
   */
  toStringWithGrammarName() {
    return `{ ${this.NT}: \`${this.rule
      .map((g) => g.toGrammarStringWithName())
      .join(" ")}\` }`;
  }
}
