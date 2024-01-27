import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  IStatelessLexer,
  IToken,
} from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { NTNodeTraverser } from "../../../traverser";
import type {
  Callback,
  Condition,
  Grammar,
  GrammarRepo,
  GrammarRuleID,
  GrammarString,
} from "../../model";
import { GrammarRule } from "../../model";
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
 * Grammar, but can't distinguish T or NT.
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

  /**
   * @see {@link Grammar.grammarString}.
   */
  readonly grammarString: GrammarString;

  constructor(p: Pick<TempGrammar, "type" | "content" | "name">) {
    this.type = p.type;
    this.content = p.content;
    this.name = p.name;

    this.grammarString = this.getGrammarString();
  }

  toGrammar<
    NTs extends string,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
    /**
     * Lexer is required to lex the literal grammar's kind name.
     */
    lexer: IStatelessLexer<LexerDataBindings, LexerActionState, LexerErrorType>,
    defaultActionState: LexerActionState,
    printAll: boolean,
    logger: Logger,
    isNT = true,
  ) {
    if (this.type === TempGrammarType.LITERAL) {
      const { token } = lexer.lex(this.content, {
        actionState: defaultActionState,
      });
      if (token === undefined) {
        // for un-lexable literal, throw error instead of using anonymous type
        // this is to prevent mis-writing literal grammar
        const e = new InvalidLiteralError(this.content);
        if (printAll) logger.log({ entity: "Parser", message: e.message });
        else throw e;
      }
      // when printAll, the token might be null, we set the default kind to empty string
      const kind = token?.kind ?? ("" as ExtractKinds<LexerDataBindings>);
      return repo.Literal(this.content, kind, this.name ?? kind) as Grammar<
        NTs | ExtractKinds<LexerDataBindings>
      >;
    }

    return (
      isNT
        ? repo.NT(this.content as NTs, this.name ?? this.content)
        : repo.T(
            this.content as ExtractKinds<LexerDataBindings>,
            this.name ?? this.content,
          )
    ) as Grammar<NTs | ExtractKinds<LexerDataBindings>>;
  }

  /**
   * @see {@link Grammar.grammarString}
   */
  private getGrammarString(): GrammarString {
    // follow the format of [[@grammar string]]
    return this.type === TempGrammarType.LITERAL
      ? `'${JSON.stringify(this.content).slice(1, -1)}'` + // quote text, escape literal
          (this.name === undefined ? "" : "@" + this.name)
      : this.content +
          (this.name === undefined || this.name === this.content
            ? ""
            : "@" + this.name);
  }
}

/**
 * Grammar rule, but can't distinguish N or NT.
 */
export class TempGrammarRule<
  NT extends NTs,
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  readonly rule: readonly TempGrammar[];
  /**
   * The reduce target.
   */
  readonly NT: NT;
  callback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  rejecter?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  commit?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  traverser?: NTNodeTraverser<
    NT,
    NTs,
    ASTData,
    ErrorType,
    IToken<LexerDataBindings, LexerErrorType>,
    Global
  >;
  readonly hydrationId: number;
  /**
   * @see {@link GrammarRule.id}.
   */
  readonly id: GrammarRuleID;

  constructor(
    data: Pick<
      TempGrammarRule<
        NT,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
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
    this.id = GrammarRule.generateId(this);
  }
}
