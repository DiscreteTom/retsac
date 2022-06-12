import { ASTData, ASTNode } from "../ast";

export class Grammar {
  type: "literal" | "T" | "NT";
  content: string; // literal content, or T/NT's type name

  constructor(p: Omit<Grammar, "eq">) {
    Object.assign(this, p);
  }

  eq(g: Grammar | ASTNode) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else
      return this.type == "literal"
        ? this.content == g.text
        : this.content == g.type;
  }

  toString() {
    return this.type == "literal" ? `"${this.content}"` : this.content;
  }
}

export class GrammarRule {
  rule: Grammar[];
  NT: string; // the reduce target
  callback: GrammarCallback;
  rejecter: Rejecter;

  constructor(p: Partial<GrammarRule>) {
    p.callback ??= () => {};
    p.rejecter ??= () => false;
    p.NT ??= "";

    if (!p.rule?.length) throw new Error(`Rule can NOT be empty.`);

    Object.assign(this, p);
  }

  toString(sep = " ") {
    return `${this.NT} => ${this.rule.map((r) => r.toString()).join(sep)}`;
  }
}

export type ReducerContext = {
  data: ASTData;
  readonly matched: ASTNode[];
  readonly before: ASTNode[];
  readonly after: ASTNode[];
  error: string;
};

export type GrammarCallback = (context: ReducerContext) => void;

export type Rejecter = (context: ReducerContext) => boolean; // return true if conflict

export class GrammarSet {
  private gs: Grammar[];

  constructor() {
    this.gs = [];
  }

  has(g: Grammar | ASTNode) {
    return !this.gs.every((gg) => !gg.eq(g));
  }

  /** Return true if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.push(g);
    return true;
  }

  map<T>(f: (g: Grammar) => T) {
    return this.gs.map(f);
  }
}
