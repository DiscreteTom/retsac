export class ASTNode {
  type: string;
  text?: string;
  children: ASTNode[];
  parent: ASTNode;
  data: { value: any; [key: string]: any };

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
