import type {
  GeneralTokenDataBinding,
  IReadonlyLexer,
  Token,
} from "../../../lexer";
import type { ASTNode } from "../../ast";
import type {
  ASTNodeChildrenSelector,
  ASTNodeFirstMatchChildSelector,
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../selector";

/**
 * This is used in grammar rule's callback, reducer and condition of rejecter/committer.
 */
export class GrammarRuleContext<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  readonly matched: readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
  >[];
  /**
   * The AST nodes before the current grammar rule.
   * This is lazy and cached.
   */
  get before(): readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
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
  readonly $: ASTNodeFirstMatchChildSelector<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
  >;
  /**
   * Find AST nodes by the name.
   */
  readonly $$: ASTNodeChildrenSelector<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
  >;
  /**
   * Current lexer state.
   * If you need to modify it, please use `lexer.clone()` or `lexer.dryClone()`.
   */
  readonly lexer: IReadonlyLexer<
    LexerDataBindings,
    LexerActionState,
    LexerError
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
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
  >[];
  private _before?: readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
  >[];
  private _values?: readonly (ASTData | undefined)[];

  constructor(
    p: Pick<
      GrammarRuleContext<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "matched" | "lexer"
    > & {
      beforeFactory: () => ASTNode<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerError>
      >[];
      selector: ASTNodeSelector<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerError>
      >;
      firstMatchSelector: ASTNodeFirstMatchSelector<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerError>
      >;
    },
  ) {
    this.matched = p.matched;
    this.lexer = p.lexer;
    this.beforeFactory = p.beforeFactory;
    const selector = p.selector;
    const firstMatchSelector = p.firstMatchSelector;
    this.$ = (name: string) => firstMatchSelector(name, this.matched);
    this.$$ = (name: string) => selector(name, this.matched);
  }
}

/**
 * This will be called if the current grammar rule is accepted.
 */
export type Callback<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = (
  context: GrammarRuleContext<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
) => void;

export type Condition<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = (
  context: GrammarRuleContext<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
) => boolean;

/**
 * Reducer should use children's data to yield the parent's data.
 */
export type Reducer<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = (
  context: GrammarRuleContext<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
) => ASTData | undefined;
