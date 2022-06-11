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

export type ReducerContext = {
  data: ASTData;
  readonly matched: ASTNode[];
  readonly before: ASTNode[];
  readonly after: ASTNode[];
  error: string;
};

export type GrammarCallback = (context: ReducerContext) => void;

export type Rejecter = (context: ReducerContext) => boolean; // return true if conflict
