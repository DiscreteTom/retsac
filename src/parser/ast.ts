export type ASTData = { value: any; [key: string]: any };

export class ASTNode {
  type: string; // T's or NT's name
  text: string; // T's text content
  children: ASTNode[];
  parent: ASTNode;
  data: ASTData;
  error: string; // empty if no error

  constructor(p: {
    type: string;
    text?: string;
    children?: ASTNode[];
    parent?: ASTNode;
    error?: string;
    data?: ASTData;
  }) {
    this.type = p.type;
    this.text = p.text ?? "";
    this.children = p.children ?? [];
    this.parent = p.parent ?? null;
    this.error = p.error ?? "";
    this.data = p.data ?? { value: null };
  }

  toString(indent = "", anonymous = "<anonymous>") {
    let res = `${indent}${this.type || anonymous}: `;
    if (this.text) res += this.text;
    res += "\n";
    this.children.map((c) => {
      res += c.toString(indent + "  ");
    });
    return res;
  }
}
