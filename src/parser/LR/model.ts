import { ASTData, ASTNode } from "../ast";

export enum GrammarType {
  /** Literal string. */
  LITERAL,
  /** Terminator. */
  T,
  /** Non-terminator. */
  NT,
}

export class Grammar {
  type: GrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;

  constructor(p: Pick<Grammar, "type" | "content">) {
    Object.assign(this, p);
  }

  /** Equals to. */
  eq(g: Grammar | ASTNode) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else
      return this.type == GrammarType.LITERAL
        ? this.content == g.text // check literal content
        : this.content == g.type; // check type name
  }

  /** Return `type` or `"literal"` */
  toString() {
    return this.type == GrammarType.LITERAL
      ? `"${this.content}"` // literal content
      : this.content; // type name
  }
}

export class GrammarRule {
  rule: Grammar[];
  /** The reduce target. */
  NT: string;
  callback: GrammarCallback;
  rejecter: Rejecter;

  constructor(
    p: Partial<Pick<GrammarRule, "callback" | "rejecter" | "NT">> &
      Pick<GrammarRule, "rule">
  ) {
    p.callback ??= () => {};
    p.rejecter ??= () => false;
    p.NT ??= "";

    if (!p.rule.length) throw new Error(`Rule can NOT be empty.`);

    Object.assign(this, p);
  }

  /** Return `NT => grammar rules`. */
  toString(sep = " ", arrow = "=>") {
    return [this.NT, arrow, ...this.rule.map((r) => r.toString())].join(sep);
  }
}

export type ReducerContext = {
  /** Data of the result AST node. */
  data: ASTData;
  readonly matched: ASTNode[];
  readonly before: ASTNode[];
  readonly after: ASTNode[];
  /** `null` if no error. */
  error: any;
};

/** Will be called if the current grammar is accepted. */
export type GrammarCallback = (context: ReducerContext) => void;

/** Grammar rejecter. Return `true` to reject to use the current grammar. */
export type Rejecter = (context: ReducerContext) => boolean;

/** A set of different grammars. */
export class GrammarSet {
  /** Grammars. */
  private gs: Grammar[];

  constructor() {
    this.gs = [];
  }

  has(g: Grammar | ASTNode) {
    return !this.gs.every((gg) => !gg.eq(g));
  }

  /** Return `true` if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.push(g);
    return true;
  }

  map<T>(f: (g: Grammar) => T) {
    return this.gs.map(f);
  }
}
