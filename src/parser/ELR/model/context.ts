import type { StringOrLiteral } from "../../../helper";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  IReadonlyTrimmedLexer,
  Token,
} from "../../../lexer";
import type { ASTNode } from "../../ast";
import type {
  NTNodeChildrenSelector,
  NTNodeFirstMatchChildSelector,
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../selector";

/**
 * This is used in grammar rule's callback, reducer and condition of rejecter/committer.
 */
export class GrammarRuleContext<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  readonly matched: readonly ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  /**
   * The AST nodes before the current grammar rule.
   * This is lazy and cached.
   */
  get before(): readonly ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[] {
    return this._before ?? (this._before = this.beforeFactory());
  }
  /**
   * The un-lexed input.
   * This is lazy and cached.
   */
  get after() {
    return this.lexer.getRest();
  }
  readonly $: NTNodeFirstMatchChildSelector<
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;
  /**
   * Find AST nodes by the name.
   */
  readonly $$: NTNodeChildrenSelector<
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;
  /**
   * Current lexer state.
   * If you need to modify it, please use `lexer.clone()` or `lexer.dryClone()`.
   */
  readonly lexer: IReadonlyTrimmedLexer<
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  /**
   * Data of the result AST node.
   * You can set this field, and if the grammar rule is accepted,
   * the result AST node will be created with this data.
   */
  data?: ASTData;
  error?: ErrorType;
  /**
   * The list of data of the matched AST nodes.
   * This is lazy and cached.
   */
  get values() {
    return (
      this._values ?? (this._values = this.matched.map((node) => node.data))
    );
  }
  private beforeFactory: () => ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  private _before?: readonly ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  private _values?: readonly (ASTData | undefined)[];

  constructor(
    p: Pick<
      GrammarRuleContext<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
      "matched" | "lexer"
    > & {
      beforeFactory: () => ASTNode<
        NTs | ExtractKinds<LexerDataBindings>,
        NTs,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>
      >[];
      selector: ASTNodeSelector<
        NTs,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>
      >;
      firstMatchSelector: ASTNodeFirstMatchSelector<
        NTs,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>
      >;
    },
  ) {
    this.matched = p.matched;
    this.lexer = p.lexer;
    this.beforeFactory = p.beforeFactory;
    this.$ = <
      TargetKind extends StringOrLiteral<NTs | ExtractKinds<LexerDataBindings>>,
    >(
      name: TargetKind,
    ) => p.firstMatchSelector(name, this.matched);
    this.$$ = <
      TargetKind extends StringOrLiteral<NTs | ExtractKinds<LexerDataBindings>>,
    >(
      name: TargetKind,
    ) => p.selector(name, this.matched);
  }
}

/**
 * This will be called if the current grammar rule is accepted.
 */
export type Callback<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = (
  context: GrammarRuleContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
) => void;

export type Condition<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = (
  context: GrammarRuleContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
) => boolean;

/**
 * Reducer should use children's data to yield the parent's data.
 */
export type Reducer<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = (
  context: GrammarRuleContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
) => ASTData | undefined;
