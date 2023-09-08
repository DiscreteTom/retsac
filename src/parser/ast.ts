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
export type ASTNodeChildrenSelector<ASTData, Kinds extends string> = (
  name: string
) => ASTNode<ASTData, Kinds>[];

export type ASTNodeSelector<ASTData, Kinds extends string> = (
  name: string,
  nodes: readonly ASTNode<ASTData, Kinds>[]
) => ASTNode<ASTData, Kinds>[];

/**
 * This is used when the ASTNode is not an NT, or the ASTNode is temporary.
 */
export const mockASTNodeSelector: ASTNodeSelector<any, any> = () => [];

/**
 * Traverser is called when a top-down traverse is performed.
 * The result of the traverser is stored in the ASTNode's data field.
 */
export type Traverser<ASTData, Kinds extends string> = (
  self: ASTNode<ASTData, Kinds>
) => ASTData | undefined | void;

/**
 * The default traverser.
 */
export function defaultTraverser<ASTData, Kinds extends string>(
  self: ASTNode<ASTData, Kinds>
): ASTData | undefined | void {
  if (self.children !== undefined) {
    // if there is only one child, use its data or traverse to get its data
    if (self.children.length == 1)
      return self.children![0].data ?? self.children![0].traverse();
    // if there are multiple children, traverse all, don't return anything
    self.children.forEach((c) => c.traverse());
  } else {
    // if there is no children, then this node is a T and the traverse should not be called
    throw new InvalidTraverseError(self);
  }
}

// TODO: default ASTData type?
export class ASTNode<ASTData, Kinds extends string> {
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  readonly kind: Kinds;
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
  children?: readonly ASTNode<ASTData, Kinds>[];
  /**
   * Parent must be an NT node, or `undefined` if this node is a top level node.
   * This is not readonly because it will be set by parent node.
   */
  parent?: ASTNode<ASTData, Kinds>;
  /**
   * Data calculated by traverser.
   * You can also set this field manually if you don't use top-down traverse.
   */
  data?: ASTData;
  error?: any; // TODO: generic type?
  /**
   * Select children nodes by the name.
   */
  readonly $: ASTNodeChildrenSelector<ASTData, Kinds>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   * Make this private to prevent users from using it by mistake.
   */
  // TODO: remove this, just keep traverse, and init it in constructor
  private traverser: Traverser<ASTData, Kinds>;
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
      ASTNode<ASTData, Kinds>,
      "kind" | "start" | "text" | "children" | "parent" | "data" | "error"
    > & {
      traverser?: Traverser<ASTData, Kinds>;
      selector?: ASTNodeSelector<ASTData, Kinds>;
    } & Partial<Pick<ASTNode<ASTData, Kinds>, "name">>
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
    this.$ = (name: string) => selector(name, this.children ?? []);

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

  static from<ASTData, Kinds extends string>(t: Readonly<Token<any, Kinds>>) {
    return new ASTNode<ASTData, Kinds>({
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
        : `${this.kind}(${this.name})`
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
   * Format: `kind(name): text`.
   * This value will be changed if you change the name of this node.
   */
  static getStrWithName(
    data: Pick<ASTNode<any, any>, "kind" | "name" | "text">
  ) {
    return (
      `${data.kind == "" ? "<anonymous>" : data.kind}` +
      `${data.name == data.kind ? "" : `(${data.name})`}` +
      `${data.text == undefined ? "" : `: ${JSON.stringify(data.text)}`}`
    );
  }

  /**
   * Format: `kind: text`.
   */
  static getStrWithoutName(data: Pick<ASTNode<any, any>, "kind" | "text">) {
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
   */
  traverse(): ASTData | undefined {
    const res = this.traverser(this);
    this.data =
      res ??
      (res === null
        ? (null as ASTData)
        : // undefined or void
          undefined);
    return this.data;
  }
}
