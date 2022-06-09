import { ASTNode } from "../ast";
import { GrammarCallback, Rejecter } from "../simple/model";

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
}

export class GrammarSet {
  private grammars: Grammar[];

  constructor() {
    this.grammars = [];
  }

  has(g: Grammar | ASTNode) {
    for (const gg of this.grammars) if (gg.eq(g)) return true;
    return false;
  }

  /**
   * Return true if successfully added.
   */
  add(g: Grammar) {
    if (!this.has(g)) {
      this.grammars.push(g);
      return true;
    }
    return false;
  }

  map<T>(f: (g: Grammar) => T) {
    return this.grammars.map(f);
  }
}
