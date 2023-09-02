import { ILexer } from "../../../lexer";
import { ASTNode, ASTNodeChildrenSelector, ASTNodeSelector } from "../../ast";

/**
 * This is used in grammar rule's callback, rejector and accepter.
 */
// TODO: what is the accepter?
export class GrammarRuleContext<T> {
  readonly matched: readonly ASTNode<T>[];
  /**
   * The AST nodes before the current grammar rule.
   * This is lazy and cached.
   */
  get before(): readonly ASTNode<T>[] {
    return this._before ?? (this._before = this.beforeFactory());
  }
  /**
   * The un-lexed input.
   * This is lazy and cached.
   */
  get after() {
    return this.lexer.getRest();
  }
  /**
   * Find AST nodes by the name.
   */
  readonly $: ASTNodeChildrenSelector<T>;
  /**
   * Current lexer state. You'd better not modify it.
   * If you need to modify it, please use `lexer.clone()` or `lexer.dryClone()`.
   */
  readonly lexer: ILexer<any>; // TODO: use the correct type
  /**
   * Data of the result AST node.
   * You can set this field, and if the grammar rule is accepted,
   * the result AST node will be created with this data.
   */
  data?: T;
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
  private beforeFactory: () => ASTNode<T>[];
  private _before?: readonly ASTNode<T>[];
  private _values?: readonly (T | undefined)[];

  constructor(
    p: Pick<GrammarRuleContext<T>, "matched" | "lexer"> & {
      beforeFactory: () => ASTNode<T>[];
      selector: ASTNodeSelector<T>;
    }
  ) {
    this.matched = p.matched;
    this.lexer = p.lexer;
    this.beforeFactory = p.beforeFactory;
    const selector = p.selector;
    this.$ = (name: string) => selector(name, this.matched);
  }
}

/**
 * This will be called if the current grammar rule is accepted.
 */
export type Callback<T> = (context: GrammarRuleContext<T>) => void;

export type Condition<T> = (context: GrammarRuleContext<T>) => boolean;

/**
 * Reducer should use children's data to yield the parent's data.
 */
export type Reducer<T> = (context: GrammarRuleContext<T>) => T | undefined;
