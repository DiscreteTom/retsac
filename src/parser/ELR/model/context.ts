import { ILexer } from "../../../lexer";
import {
  ASTNode,
  ASTNodeChildrenSelector,
  ASTNodeFirstMatchChildSelector,
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../ast";

/**
 * This is used in grammar rule's callback, reducer and condition of rejecter/committer.
 */
export class GrammarRuleContext<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> {
  readonly matched: readonly ASTNode<ASTData, Kinds | LexerKinds>[];
  /**
   * The AST nodes before the current grammar rule.
   * This is lazy and cached.
   */
  get before(): readonly ASTNode<ASTData, Kinds | LexerKinds>[] {
    return this._before ?? (this._before = this.beforeFactory());
  }
  /**
   * The un-lexed input.
   * This is lazy and cached.
   */
  get after() {
    return this.lexer.getRest();
  }
  readonly $: ASTNodeFirstMatchChildSelector<ASTData, Kinds | LexerKinds>;
  /**
   * Find AST nodes by the name.
   */
  readonly $$: ASTNodeChildrenSelector<ASTData, Kinds | LexerKinds>;
  /**
   * Current lexer state. You'd better not modify it.
   * If you need to modify it, please use `lexer.clone()` or `lexer.dryClone()`.
   */
  readonly lexer: ILexer<any, LexerKinds>;
  /**
   * Data of the result AST node.
   * You can set this field, and if the grammar rule is accepted,
   * the result AST node will be created with this data.
   */
  data?: ASTData;
  error?: any; // TODO: use generic type
  /**
   * The list of data of the matched AST nodes.
   * This is lazy and cached.
   */
  get values() {
    return (
      this._values ?? (this._values = this.matched.map((node) => node.data))
    );
  }
  private beforeFactory: () => ASTNode<ASTData, Kinds | LexerKinds>[];
  private _before?: readonly ASTNode<ASTData, Kinds | LexerKinds>[];
  private _values?: readonly (ASTData | undefined)[];

  constructor(
    p: Pick<
      GrammarRuleContext<ASTData, Kinds, LexerKinds>,
      "matched" | "lexer"
    > & {
      beforeFactory: () => ASTNode<ASTData, Kinds | LexerKinds>[];
      selector: ASTNodeSelector<ASTData, Kinds | LexerKinds>;
      firstMatchSelector: ASTNodeFirstMatchSelector<
        ASTData,
        Kinds | LexerKinds
      >;
    }
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
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = (context: GrammarRuleContext<ASTData, Kinds, LexerKinds>) => void;

export type Condition<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = (context: GrammarRuleContext<ASTData, Kinds, LexerKinds>) => boolean;

/**
 * Reducer should use children's data to yield the parent's data.
 */
export type Reducer<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = (
  context: GrammarRuleContext<ASTData, Kinds, LexerKinds>
) => ASTData | undefined;
