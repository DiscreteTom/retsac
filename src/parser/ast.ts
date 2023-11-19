import type { ExtractKinds, GeneralToken } from "../lexer";
import {
  type ASTNodeFirstMatchChildSelector,
  type ASTNodeChildrenSelector,
  type ASTNodeSelector,
  type ASTNodeFirstMatchSelector,
  defaultASTNodeSelector,
  defaultASTNodeFirstMatchSelector,
} from "./selector";
import type { LazyString } from "../lazy";
import { Lazy } from "../lazy";
import { InvalidTraverseError } from "./error";
import type { Traverser } from "./traverser";
import { defaultTraverser } from "./traverser";

/**
 * A structured type for serialization.
 * Every field is not null/undefined.
 */
export type ASTObj = {
  /**
   * By default, this is the same as the kind name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  kind: string;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  start: number;
  /**
   * T's text content.
   * If this is not a T, the value is an empty string.
   */
  text: string;
  /**
   * NT's children.
   * If this is not an NT, the value is an empty array.
   */
  children: ASTObj[];
};

export class ASTNode<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> {
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  readonly kind: Kinds | ExtractKinds<TokenType>;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  readonly start: number;
  /**
   * T's text content.
   */
  readonly text?: string;
  /**
   * NT's children.
   */
  children?: readonly ASTNode<Kinds, ASTData, ErrorType, TokenType>[]; // TODO: conditional make this non nullable
  /**
   * Parent must be an NT node, or `undefined` if this node is a top level node.
   * This is not readonly because it will be set by parent node.
   */
  parent?: ASTNode<Kinds, ASTData, ErrorType, TokenType>; // TODO: conditional make this non nullable
  /**
   * Data calculated by traverser.
   * You can also set this field manually if you don't use top-down traverse.
   */
  data?: ASTData;
  error?: ErrorType;
  /**
   * If this is a T, this field is set.
   */
  token?: TokenType; // TODO: conditional make this non nullable
  /**
   * Select the first matched child node by the name.
   */
  readonly $: ASTNodeFirstMatchChildSelector<
    Kinds,
    ASTData,
    ErrorType,
    TokenType
  >;
  /**
   * Select children nodes by the name.
   */
  readonly $$: ASTNodeChildrenSelector<Kinds, ASTData, ErrorType, TokenType>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   * Make this private to prevent users from using it by mistake.
   */
  private traverser: Traverser<Kinds, ASTData, ErrorType, TokenType>;
  /**
   * `name` is set by parent node, so it should NOT be readonly, but can only be set privately.
   */
  private _name: string;

  /**
   * @see {@link ASTNode.toString}
   */
  readonly str: LazyString;
  /**
   * @see {@link ASTNode.getStrWithName}
   */
  readonly strWithName: LazyString;
  /**
   * @see {@link ASTNode.getStrWithoutName}
   */
  readonly strWithoutName: LazyString;

  constructor(
    p: Pick<
      ASTNode<Kinds, ASTData, ErrorType, TokenType>,
      "kind" | "start" | "text" | "children" | "parent" | "data" | "error"
    > & {
      traverser?: Traverser<Kinds, ASTData, ErrorType, TokenType>;
      selector?: ASTNodeSelector<Kinds, ASTData, ErrorType, TokenType>;
      firstMatchSelector?: ASTNodeFirstMatchSelector<
        Kinds,
        ASTData,
        ErrorType,
        TokenType
      >;
    } & Partial<
        Pick<ASTNode<Kinds, ASTData, ErrorType, TokenType>, "name" | "token">
      >,
  ) {
    this._name = p.name ?? p.kind;
    this.kind = p.kind;
    this.start = p.start;
    this.text = p.text;
    this.children = p.children;
    this.parent = p.parent;
    this.data = p.data;
    this.error = p.error;
    this.token = p.token;
    this.traverser = p.traverser ?? defaultTraverser;
    const selector = p.selector ?? defaultASTNodeSelector;
    const firstMatchSelector =
      p.firstMatchSelector ?? defaultASTNodeFirstMatchSelector;
    this.$ = (name: string) => firstMatchSelector(name, this.children ?? []);
    this.$$ = (name: string) => selector(name, this.children ?? []);

    this.str = new Lazy(
      () =>
        `ASTNode({ kind: "${this.kind}", start: ${
          this.start
        }, text: ${JSON.stringify(this.text)}, data: ${JSON.stringify(
          this.data,
        )}, error: ${JSON.stringify(this.error)} })`,
    );
    this.strWithName = new Lazy(() => ASTNode.getStrWithName(this));
    this.strWithoutName = new Lazy(() => ASTNode.getStrWithoutName(this));
  }

  static from<
    Kinds extends string,
    ASTData,
    ErrorType,
    TokenType extends GeneralToken,
  >(t: Readonly<TokenType>) {
    return new ASTNode<Kinds, ASTData, ErrorType, TokenType>({
      kind: t.kind,
      start: t.start,
      text: t.content,
      token: t,
    });
  }

  /**
   * By default, this is the same as the kind name.
   * You can rename nodes in your grammar rules.
   */
  get name() {
    return this._name;
  }

  set name(name: string) {
    this._name = name;
    this.strWithName.reset(); // clear the cache
  }

  /**
   * Return a tree-structured string.
   * The result is NOT cached.
   */
  toTreeString(options?: { indent?: string }) {
    const indent = options?.indent ?? "";

    // don't use `this.toStringWithName` here
    // since this output will always have ': '
    const kind = this.kind === "" ? "<anonymous>" : this.kind;
    let res = `${indent}${
      this.kind === this.name ? kind : `${kind}@${this.name}`
    }: `;
    if (this.text) res += JSON.stringify(this.text); // quote the text
    res += "\n";
    this.children?.forEach((c) => {
      res += c.toTreeString({
        indent: indent + "  ",
      });
    });
    return res;
  }

  /**
   * For debug output.
   */
  toString() {
    return this.str.value;
  }

  /**
   * Format: `kind@name: text`.
   * This value will be changed if you change the name of this node.
   */
  static getStrWithName(
    data: Pick<
      ASTNode<string, unknown, unknown, GeneralToken>,
      "kind" | "name" | "text"
    >,
  ) {
    return (
      `${data.kind === "" ? "<anonymous>" : data.kind}` +
      `${data.name === data.kind ? "" : `@${data.name}`}` +
      `${data.text === undefined ? "" : `: ${JSON.stringify(data.text)}`}`
    );
  }

  /**
   * Format: `kind: text`.
   */
  static getStrWithoutName(
    data: Pick<
      ASTNode<string, unknown, unknown, GeneralToken>,
      "kind" | "text"
    >,
  ) {
    return (
      `${data.kind === "" ? "<anonymous>" : data.kind}` +
      `${data.text === undefined ? "" : `: ${JSON.stringify(data.text)}`}`
    );
  }

  /**
   * Return an ASTObj for serialization.
   */
  toJSON(): ASTObj {
    return {
      name: this.name,
      kind: this.kind,
      start: this.start,
      text: this.text || "",
      children: this.children?.map((c) => c.toJSON()) ?? [],
    };
  }

  /**
   * Use the traverser to calculate data and return the data.
   *
   * @throws {InvalidTraverseError} if the node is a leaf node (no children).
   */
  traverse(): ASTData | undefined {
    if (this.children === undefined) throw new InvalidTraverseError(this);
    const res = this.traverser(
      this as Parameters<Traverser<Kinds, ASTData, ErrorType, TokenType>>[0], // children is not undefined
    );
    this.data =
      res ??
      (res === null
        ? (null as ASTData)
        : // undefined or void
          undefined);
    return this.data;
  }
}
