import { ASTNode } from "../ast";
import { ParserError, ParserErrorType } from "./error";

export enum GrammarType {
  /** Literal string. */
  LITERAL,
  /** Terminator. */
  T,
  /** Non-terminator. */
  NT,
}

export class Grammar<T> {
  type: GrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;

  constructor(p: Pick<Grammar<T>, "type" | "content">) {
    Object.assign(this, p);
  }

  /** Equals to. */
  eq(g: Grammar<T> | ASTNode<T>) {
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

export class GrammarRule<T> {
  rule: Grammar<T>[];
  /** The reduce target. */
  NT: string;
  callback: GrammarCallback<T>;
  rejecter: Rejecter<T>;

  constructor(
    p: Partial<Pick<GrammarRule<T>, "callback" | "rejecter" | "NT">> &
      Pick<GrammarRule<T>, "rule">
  ) {
    p.callback ??= () => {};
    p.rejecter ??= () => false;
    p.NT ??= "";

    if (!p.rule.length)
      throw new ParserError(
        ParserErrorType.EMPTY_RULE,
        `Rule can NOT be empty.`
      );

    Object.assign(this, p);
  }

  /** Return `NT <= grammar rules`. */
  toString(sep = " ", arrow = "<=") {
    return [this.NT, arrow, ...this.rule.map((r) => r.toString())].join(sep);
  }
}

export type ReducerContext<T> = {
  /** Data of the result AST node. */
  data: T;
  readonly matched: ASTNode<T>[];
  readonly before: ASTNode<T>[];
  readonly after: ASTNode<T>[];
  error?: any;
};

/** Will be called if the current grammar is accepted. */
export type GrammarCallback<T> = (context: ReducerContext<T>) => void;

/** Grammar rejecter. Return `true` to reject to use the current grammar. */
export type Rejecter<T> = (context: ReducerContext<T>) => boolean;

/** A set of different grammars. */
export class GrammarSet<T> {
  /** Grammars. */
  private gs: Grammar<T>[];

  constructor() {
    this.gs = [];
  }

  has(g: Grammar<T> | ASTNode<T>) {
    return !this.gs.every((gg) => !gg.eq(g));
  }

  /** Return `true` if successfully added. */
  add(g: Grammar<T>) {
    if (this.has(g)) return false;
    this.gs.push(g);
    return true;
  }

  map<TT>(f: (g: Grammar<T>) => TT) {
    return this.gs.map(f);
  }
}
