export class ASTNode {
  type: string;
  text: string;
  children: ASTNode[];
  parent: ASTNode;
  data: { value: any; [key: string]: any };

  constructor(p: {
    type: string;
    text?: string;
    children?: ASTNode[];
    parent?: ASTNode;
  }) {
    this.type = p.type;
    this.text = p.text ?? "";
    this.children = p.children ?? [];
    this.parent = p.parent ?? null;
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
