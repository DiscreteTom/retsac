import { Token } from "../lexer";
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
export type ASTNodeChildrenSelector<T> = (name: string) => ASTNode<T>[];

export type ASTNodeSelector<T> = (
  name: string,
  nodes: readonly ASTNode<T>[]
) => ASTNode<T>[];

/**
 * This is used when the ASTNode is not an NT, or the ASTNode is temporary.
 */
export const mockASTNodeSelector: ASTNodeSelector<any> = () => [];

/**
 * Traverser is called when a top-down traverse is performed.
 * The result of the traverser is stored in the ASTNode's data field.
 */
export type Traverser<T> = (self: ASTNode<T>) => T | undefined | void;

/**
 * The default traverser.
 */
export function defaultTraverser<T>(self: ASTNode<T>): T | undefined | void {
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

// TODO: default T
export class ASTNode<T> {
  /**
   * T's or NT's kind name.
   * If the T is anonymous, the value is an empty string.
   */
  readonly kind: string;
  /**
   * Start position of the whole input string.
   * Same as the first token's start position.
   */
  readonly start: number;
  /**
   * T's text content.
   */
  readonly text?: string; // TODO: use new-type pattern to make sure this is not undefined?
  /**
   * NT's children.
   */
  children?: readonly ASTNode<T>[]; // TODO: use new-type pattern to make sure this is not undefined?
  /**
   * Parent must be an NT unless this node is a root node, in this case parent is undefined.
   */
  parent?: ASTNode<T>;
  /**
   * Data calculated by traverser.
   * You can also set this field manually if you don't use top-down traverse.
   */
  data?: T;
  error?: any; // TODO: generic type?
  /**
   * Select children nodes by the name.
   */
  readonly $: ASTNodeChildrenSelector<T>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   */
  private traverser: Traverser<T>;
  /**
   * `name` is set by parent node, so it should NOT be readonly, but can only be set privately.
   */
  private _name: string;
  /**
   * Cache the string representation.
   */
  private str?: string;

  constructor(
    p: Pick<
      ASTNode<T>,
      "kind" | "start" | "text" | "children" | "parent" | "data" | "error"
    > & {
      traverser?: Traverser<T>;
      selector?: ASTNodeSelector<T>;
    } & Partial<Pick<ASTNode<T>, "name">>
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
    // this.str = undefined;
  }

  static from<T>(t: Readonly<Token<any>>) {
    return new ASTNode<T>({ kind: t.kind, start: t.start, text: t.content });
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
    this.str = undefined; // clear the cache
  }

  /**
   * Return a tree-structured string.
   * The result is not cached.
   */
  toTreeString(options?: {
    initialIndent?: string;
    indent?: string;
    anonymous?: string;
  }) {
    const initialIndent = options?.initialIndent ?? "";
    const indent = options?.indent ?? "  ";
    const anonymous = options?.anonymous ?? "<anonymous>";

    let res = `${initialIndent}${
      this.kind == ""
        ? anonymous
        : this.kind == this.name
        ? this.kind
        : `${this.kind}(${this.name})`
    }: `;
    if (this.text) res += JSON.stringify(this.text); // quote the text
    res += "\n";
    this.children?.forEach((c) => {
      res += c.toTreeString({
        initialIndent: initialIndent + indent,
        indent,
        anonymous,
      });
    });
    return res;
  }

  /**
   * Format: `kind(name): text`.
   * The result is lazy and cached.
   * This value will be changed if you change the name of this node.
   */
  toString() {
    return (
      this.str ??
      (this.str =
        `${this.kind == "" ? "<anonymous>" : this.kind}` +
        `${this.name == this.kind ? "" : `(${this.name})`}` +
        `${this.text ? `: ${JSON.stringify(this.text)}` : ""}`)
    );
  }

  /**
   * Format: `kind: text`.
   * This is not changed by the name, so it's suitable to be a key in a map.
   * This is lazy and cached.
   */
  toUniqueString() {
    return (
      this.uniqueStr ??
      (this.uniqueStr =
        `${this.kind == "" ? "<anonymous>" : this.kind}` +
        `${this.text == undefined ? "" : `: ${this.text}`}`)
    );
  }
  private uniqueStr?: string;

  /**
   * Return an ASTObj for serialization.
   */
  toObj(): ASTObj {
    return {
      name: this.name,
      kind: this.kind,
      start: this.start,
      text: this.text || "",
      children: this.children?.map((c) => c.toObj()) ?? [],
    };
  }

  /**
   * Use the traverser to calculate data and return the data.
   */
  traverse(): T | undefined {
    const res = this.traverser(this);
    this.data =
      res ??
      (res === null
        ? (null as T)
        : // undefined or void
          undefined);
    return this.data;
  }
}
