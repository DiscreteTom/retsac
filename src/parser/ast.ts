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
  nodes: ASTNode<T>[],
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

export class ASTNode<T> {
  /**
   * By default, this is the same as the type name.
   * You can rename nodes in your grammar rules.
   */
  name: string;
  /** T's or NT's name. */
  readonly type: string;
  /** Start position of the input string. Same as the first token's start position. */
  readonly start: number;
  /** T's text content. */
  readonly text?: string;
  /** NT's children. */
  readonly children?: readonly ASTNode<T>[];
  /** Find AST node by its name. */
  readonly $: ASTNodeQuerySelector<T>;
  /**
   * `traverser` shouldn't be exposed
   * because we want users to use `traverse` instead of `traverser` directly.
   */
  private traverser?: Traverser<T>;
  /** Parent must be an NT unless this node is the root node, in this case parent is null. */
  parent?: ASTNode<T>;
  data?: T;
  error?: any;
  /** Cache the string representation. */
  private str?: string;

  constructor(
    p: Partial<
      Pick<ASTNode<T>, "text" | "children" | "parent" | "data" | "error" | "$">
    > &
      Pick<ASTNode<T>, "type" | "start"> & { traverser?: Traverser<T> }
  ) {
    Object.assign(this, p);
  }

  static from<T>(t: Readonly<Token<any>>) {
    return new ASTNode<T>({ type: t.type, text: t.content, start: t.start });
  }

  /** Return a tree-structured string. */
  toTreeString(options?: {
    initialIndent?: string;
    indent?: string;
    anonymous?: string;
  }) {
    const initialIndent = options?.initialIndent ?? "";
    const indent = options?.indent ?? "  ";
    const anonymous = options?.anonymous ?? "<anonymous>";

    let res = `${initialIndent}${this.type || anonymous}: `;
    if (this.text) res += JSON.stringify(this.text);
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

  /** Return type name. If the type is anonymous, return "literal value". */
  toString() {
    return this.str ?? (this.str = this.type || JSON.stringify(this.text));
  }

  /** Return an ASTObj for serialization. */
  toObj(): ASTObj {
    return {
      name: this.name,
      type: this.type,
      start: this.start,
      text: this.text || "",
      children: this.children?.map((c) => c.toObj()) ?? [],
    };
  }

  /** Try to use the traverser to calculate data and return the data. */
  traverse(): T | undefined {
    const res = (this.traverser ?? defaultTraverser)(this);
    this.data =
      res ??
      (res === null
        ? (null as T)
        : // undefined or void
          undefined);
    return this.data;
  }
}

export type Traverser<T> = (self: ASTNode<T>) => T | undefined | void;

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
