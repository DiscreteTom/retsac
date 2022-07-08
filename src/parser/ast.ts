export type ASTData = { value: any; [key: string]: any };

export class ASTNode {
  /** T's or NT's name. */
  type: string;
  /** T's text content. */
  text: string;
  children: ASTNode[];
  parent: ASTNode;
  data: ASTData;
  /** `null` if no error. */
  error: any;

  constructor(p: Partial<ASTNode> & Pick<ASTNode, "type">) {
    this.type = p.type;
    this.text = p.text ?? "";
    this.children = p.children ?? [];
    this.parent = p.parent ?? null;
    this.error = p.error ?? null;
    this.data = p.data ?? { value: null };
  }

  /** Return a tree-structured string. */
  toTreeString(indent = "", anonymous = "<anonymous>") {
    let res = `${indent}${this.type || anonymous}: `;
    if (this.text) res += this.text;
    res += "\n";
    this.children.map((c) => {
      res += c.toTreeString(indent + "  ");
    });
    return res;
  }

  /** Return `NT` or `"T"`. */
  toString() {
    return this.type || `"${this.text}"`;
  }
}
