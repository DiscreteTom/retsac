import { Token } from "../lexer/model";

export class ASTNode<T> {
  /** T's or NT's name. */
  type: string;
  /** T's text content. */
  text: string;
  /** Start position of input string. */
  start: number;
  children: ASTNode<T>[];
  parent: ASTNode<T>;
  data?: T;
  /** `null` if no error. */
  error: any;

  constructor(p: Partial<ASTNode<T>> & Pick<ASTNode<T>, "type" | "start">) {
    this.type = p.type;
    this.text = p.text ?? "";
    this.children = p.children ?? [];
    this.parent = p.parent ?? null;
    this.error = p.error ?? null;
    this.data = p.data;
    this.start = p.start;
  }

  static from(t: Token) {
    return new ASTNode({ type: t.type, text: t.content, start: t.start });
  }

  /** Return a tree-structured string. */
  toTreeString(options?: {
    indent?: string;
    anonymous?: string;
    textQuote?: string;
  }) {
    let indent = options?.indent ?? "";
    let anonymous = options?.anonymous ?? "<anonymous>";
    let textQuote = options?.textQuote ?? "";

    let res = `${indent}${this.type || anonymous}: `;
    if (this.text) res += `${textQuote}${this.text}${textQuote}`;
    res += "\n";
    this.children.map((c) => {
      res += c.toTreeString({ indent: indent + "  ", anonymous, textQuote });
    });
    return res;
  }

  /** Return `NT` or `"T"`. */
  toString() {
    return this.type || `"${this.text}"`;
  }
}
