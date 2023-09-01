import { Token } from "../lexer";
import { ParserTraverseError } from "./error";

/**
 * A structured type for serialization.
 * Every field is not null/undefined.
 */
export type ASTObj = {
  /**
   * By default, this is the same as the type name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /**
   * T's or NT's name.
   * If anonymous, the value is an empty string.
   */
  type: string;
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
export type ASTNodeQuerySelector<T> = (name: string) => ASTNode<T>[];

export function ASTNodeQuerySelectorFactory<T>(
  nodes: readonly ASTNode<T>[],
  cascadeQueryPrefix?: string
): ASTNodeQuerySelector<T> {
  return (name: string) => {
    const result: ASTNode<T>[] = [];
    nodes.forEach((n) => {
      if (n.name === name) result.push(n);

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix)
      )
        result.push(...n.$(name));
    });
    return result;
  };
}

/**
 * This is used when the ASTNode is not an NT, or the ASTNode is temporary.
 */
export const mockASTNodeQuerySelector: ASTNodeQuerySelector<any> = () => [];

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
    // if there is no children, this node is a T and the traverse should not be called
    throw ParserTraverseError.traverserNotDefined();
  }
}

export class ASTNode<T> {
  /**
   * By default, this is the same as the type name.
   * You can rename nodes in your grammar rules.
   */
  readonly name: string;
  /**
   * T's or NT's name.
   * If anonymous, the value is an empty string.
   */
  readonly type: string;
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
  $: ASTNodeQuerySelector<T>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   */
  private traverser: Traverser<T>;
  /**
   * Cache the string representation.
   */
  private str?: string;

  constructor(
    p: Pick<
      ASTNode<T>,
      "type" | "start" | "text" | "children" | "parent" | "data" | "error"
    > & {
      traverser?: Traverser<T>;
    } & Partial<Pick<ASTNode<T>, "name" | "$">>
  ) {
    this.name = p.name ?? p.type;
    this.type = p.type;
    this.start = p.start;
    this.text = p.text;
    this.children = p.children;
    this.parent = p.parent;
    this.data = p.data;
    this.error = p.error;
    this.$ = p.$ ?? mockASTNodeQuerySelector;
    this.traverser = p.traverser ?? defaultTraverser;
    // this.str = undefined;
  }

  static from<T>(t: Readonly<Token<any>>) {
    return new ASTNode<T>({ type: t.type, start: t.start, text: t.content });
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
      this.type == ""
        ? anonymous
        : this.type == this.name
        ? this.type
        : `${this.type}(${this.name})`
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
   * Format: `type(name): text`.
   * The result is cached.
   */
  toString(options?: { anonymous?: string }) {
    const anonymous = options?.anonymous ?? "<anonymous>";

    // keep in mind to make sure this.type/name/text readonly for the cache to work
    return (
      this.str ??
      (this.str =
        `${this.type == "" ? anonymous : this.type}` +
        `${this.name == this.type ? "" : `(${this.name})`}` +
        `${this.text ? `: ${JSON.stringify(this.text)}` : ""}`)
    );
  }

  /**
   * Return an ASTObj for serialization.
   */
  toObj(): ASTObj {
    return {
      name: this.name,
      type: this.type,
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
