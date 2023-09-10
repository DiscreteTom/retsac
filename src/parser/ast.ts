import { Token } from "../lexer";
import { StringCache } from "./cache";
import { InvalidTraverseError } from "./error";

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

/**
 * Select children nodes by the name.
 */
export type ASTNodeChildrenSelector<
  ASTData,
  ErrorType,
  AllKinds extends string
> = (name: (string & {}) | AllKinds) => ASTNode<ASTData, ErrorType, AllKinds>[];
/**
 * Select the first matched child node by the name.
 */
export type ASTNodeFirstMatchChildSelector<
  ASTData,
  ErrorType,
  AllKinds extends string
> = (
  name: (string & {}) | AllKinds
) => ASTNode<ASTData, ErrorType, AllKinds> | undefined;
export type ASTNodeSelector<ASTData, ErrorType, AllKinds extends string> = (
  name: (string & {}) | AllKinds,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[]
) => ASTNode<ASTData, ErrorType, AllKinds>[];
export type ASTNodeFirstMatchSelector<
  ASTData,
  ErrorType,
  AllKinds extends string
> = (
  name: (string & {}) | AllKinds,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[]
) => ASTNode<ASTData, ErrorType, AllKinds> | undefined;

/**
 * This is used when the ASTNode is not an NT, or the ASTNode is temporary.
 */
export const mockASTNodeSelector: ASTNodeSelector<any, any, any> = () => [];
export const mockASTNodeFirstMatchSelector: ASTNodeFirstMatchSelector<
  any,
  any,
  any
> = () => undefined;

/**
 * Traverser is called when a top-down traverse is performed.
 * The result of the traverser is stored in the ASTNode's data field.
 * Traverser should never be called in a leaf node (no children).
 */
export type Traverser<ASTData, ErrorType, AllKinds extends string> = (
  self: ASTNode<ASTData, ErrorType, AllKinds> & {
    // children is not undefined
    children: NonNullable<ASTNode<ASTData, ErrorType, AllKinds>["children"]>;
  }
) => ASTData | undefined | void;

/**
 * The default traverser.
 */
export function defaultTraverser<ASTData, ErrorType, AllKinds extends string>(
  self: Parameters<Traverser<ASTData, ErrorType, AllKinds>>[0]
): ASTData | undefined | void {
  // if there is only one child, use its data or traverse to get its data
  if (self.children.length == 1)
    return self.children[0].data ?? self.children[0].traverse();
  // if there are multiple children, traverse all, don't return anything
  self.children.forEach((c) => c.traverse());
}

// ASTNode's AllKinds should be Parser's kinds union with Lexer's kinds
export class ASTNode<ASTData, ErrorType, AllKinds extends string> {
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  readonly kind: AllKinds;
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
  children?: readonly ASTNode<ASTData, ErrorType, AllKinds>[];
  /**
   * Parent must be an NT node, or `undefined` if this node is a top level node.
   * This is not readonly because it will be set by parent node.
   */
  parent?: ASTNode<ASTData, ErrorType, AllKinds>;
  /**
   * Data calculated by traverser.
   * You can also set this field manually if you don't use top-down traverse.
   */
  data?: ASTData;
  error?: ErrorType;
  /**
   * Select the first matched child node by the name.
   */
  readonly $: ASTNodeFirstMatchChildSelector<ASTData, ErrorType, AllKinds>;
  /**
   * Select children nodes by the name.
   */
  readonly $$: ASTNodeChildrenSelector<ASTData, ErrorType, AllKinds>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   * Make this private to prevent users from using it by mistake.
   */
  private traverser: Traverser<ASTData, ErrorType, AllKinds>;
  /**
   * `name` is set by parent node, so it should NOT be readonly, but can only be set privately.
   */
  private _name: string;

  /**
   * @see {@link ASTNode.toString}
   */
  readonly str: StringCache;
  /**
   * @see {@link ASTNode.getStrWithName}
   */
  readonly strWithName: StringCache;
  /**
   * @see {@link ASTNode.getStrWithoutName}
   */
  readonly strWithoutName: StringCache;

  constructor(
    p: Pick<
      ASTNode<ASTData, ErrorType, AllKinds>,
      "kind" | "start" | "text" | "children" | "parent" | "data" | "error"
    > & {
      traverser?: Traverser<ASTData, ErrorType, AllKinds>;
      selector?: ASTNodeSelector<ASTData, ErrorType, AllKinds>;
      firstMatchSelector?: ASTNodeFirstMatchSelector<
        ASTData,
        ErrorType,
        AllKinds
      >;
    } & Partial<Pick<ASTNode<ASTData, ErrorType, AllKinds>, "name">>
  ) {
    this._name = p.name ?? p.kind;
    this.kind = p.kind;
    this.start = p.start;
    this.text = p.text;
    this.children = p.children;
    this.parent = p.parent;
    this.data = p.data;
    this.error = p.error;
    this.traverser = p.traverser ?? defaultTraverser;
    const selector = p.selector ?? mockASTNodeSelector;
    const firstMatchSelector =
      p.firstMatchSelector ?? mockASTNodeFirstMatchSelector;
    this.$ = (name: string) => firstMatchSelector(name, this.children ?? []);
    this.$$ = (name: string) => selector(name, this.children ?? []);

    this.str = new StringCache(
      () =>
        `ASTNode({ kind: "${this.kind}", start: ${
          this.start
        }, text: ${JSON.stringify(this.text)}, data: ${JSON.stringify(
          this.data
        )}, error: ${JSON.stringify(this.error)} })`
    );
    this.strWithName = new StringCache(() => ASTNode.getStrWithName(this));
    this.strWithoutName = new StringCache(() =>
      ASTNode.getStrWithoutName(this)
    );
  }

  static from<ASTData, ErrorType, AllKinds extends string>(
    t: Readonly<Token<any, AllKinds>>
  ) {
    return new ASTNode<ASTData, ErrorType, AllKinds>({
      kind: t.kind,
      start: t.start,
      text: t.content,
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
    let res = `${indent}${
      this.kind == ""
        ? "<anonymous>"
        : this.kind == this.name
        ? this.kind
        : `${this.kind}@${this.name}`
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
    data: Pick<ASTNode<any, any, any>, "kind" | "name" | "text">
  ) {
    return (
      `${data.kind == "" ? "<anonymous>" : data.kind}` +
      `${data.name == data.kind ? "" : `@${data.name}`}` +
      `${data.text == undefined ? "" : `: ${JSON.stringify(data.text)}`}`
    );
  }

  /**
   * Format: `kind: text`.
   */
  static getStrWithoutName(
    data: Pick<ASTNode<any, any, any>, "kind" | "text">
  ) {
    return (
      `${data.kind == "" ? "<anonymous>" : data.kind}` +
      `${data.text == undefined ? "" : `: ${JSON.stringify(data.text)}`}`
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
      this as Parameters<Traverser<ASTData, ErrorType, AllKinds>>[0] // children is not undefined
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
