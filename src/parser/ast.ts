export class ASTNode {
  type: string;
  text?: string;
  children: ASTNode[];
  parent: ASTNode;
  data: { [key: string]: any };

  constructor(p: {
    type: string;
    text?: string;
    children: ASTNode[];
    parent: ASTNode;
    data?: { [key: string]: any };
  }) {
    this.text = p.text;
    this.type = p.type;
    this.children = p.children;
    this.parent = p.parent;
    this.data = p.data ?? {};
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
