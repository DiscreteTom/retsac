export class ASTNode {
  type: string; // T's or NT's name
  text: string; // T's text content
  children: ASTNode[];
  parent: ASTNode;
  data: { value: any; [key: string]: any };
  error: string; // empty if no error

  constructor(p: {
    type: string;
    text?: string;
    children?: ASTNode[];
    parent?: ASTNode;
    error?: string;
  }) {
    this.type = p.type;
    this.text = p.text ?? "";
    this.children = p.children ?? [];
    this.parent = p.parent ?? null;
    this.error = p.error ?? "";
    this.data = { value: null };
  }

  toString(indent = "") {
    let res = `${indent}${this.type}: `;
    if (this.text) res += this.text;
    res += "\n";
    this.children.map((c) => {
      res += c.toString(indent + "  ");
    });
    return res;
  }
}
