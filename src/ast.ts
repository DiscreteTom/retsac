export class ASTNode {
  type: string;
  text?: string;
  children: ASTNode[];
  parent: ASTNode;

  constructor(p: {
    type: string;
    text?: string;
    children: ASTNode[];
    parent: ASTNode;
  }) {
    this.text = p.text;
    this.type = p.type;
    this.children = p.children;
    this.parent = p.parent;
  }

  toString(indent = "") {
    let res = `${indent}${this.type}: `;
    if (this.text) res += this.text;
    res += "\n";
    this.children.map((c) => {
      res += indent + c.toString(indent + "  ");
    });
    return res;
  }
}
