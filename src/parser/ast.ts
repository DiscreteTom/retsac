import { Token } from "../lexer/model";

/** A structured interface for serialization. */
export interface ASTObj {
  /** T's or NT's name. */
  type: string;
  /** Start position of the input string. Same as the first token's start position. */
  start: number;
  /** T's text content. */
  text: string;
  /** NT's children. */
  children: ASTObj[];
}

export class ASTNode<T> {
  /** T's or NT's name. */
  type: string;
  /** Start position of the input string. Same as the first token's start position. */
  start: number;
  /** T's text content. */
  text?: string;
  /** NT's children. */
  children?: ASTNode<T>[];
  /** Parent must be an NT unless this node is the root node, in this case parent is null. */
  parent?: ASTNode<T>;
  data?: T;
  error?: any;

  constructor(p: Partial<ASTNode<T>> & Pick<ASTNode<T>, "type" | "start">) {
    Object.assign(this, p);
  }

  static from<T>(t: Token) {
    return new ASTNode<T>({ type: t.type, text: t.content, start: t.start });
  }

  /** Return a tree-structured string. */
  toTreeString(options?: {
    indent?: string;
    anonymous?: string;
    textQuote?: string;
  }) {
    const indent = options?.indent ?? "";
    const anonymous = options?.anonymous ?? "<anonymous>";
    const textQuote = options?.textQuote ?? "";

    let res = `${indent}${this.type || anonymous}: `;
    if (this.text) res += `${textQuote}${this.text}${textQuote}`;
    res += "\n";
    this.children.map((c) => {
      res += c.toTreeString({ indent: indent + "  ", anonymous, textQuote });
    });
    return res;
  }

  /** Return type name. If the type is anonymous, return "literal value". */
  toString() {
    return this.type || `"${this.text}"`;
  }

  /** Return an ASTObj for serialization. */
  toObj(): ASTObj {
    return {
      type: this.type,
      start: this.start,
      text: this.text || "",
      children: this.children?.map((c) => c.toObj()) ?? [],
    };
  }
}
