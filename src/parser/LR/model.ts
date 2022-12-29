import { ASTNode } from "../ast";
import { TempGrammar, TempGrammarType } from "./builder/grammar";
import { ParserError, ParserErrorType } from "./error";

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
  eq<_>(g: Grammar | ASTNode<_> | TempGrammar) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else if (g instanceof ASTNode)
      return this.type == GrammarType.LITERAL
        ? this.content == g.text // check literal content
        : this.content == g.type;
    // check type name
    else
      return (
        (this.type == GrammarType.LITERAL) ==
          (g.type == TempGrammarType.LITERAL) && this.content == g.content
      );
  }

  /** Return `type name` or `"literal"` */
  toString() {
    return this.type == GrammarType.LITERAL
      ? `"${this.content}"` // literal content
      : this.content; // type name
  }
}

export class GrammarRule<T> {
  rule: Grammar[];
  /** The reduce target. */
  NT: string;
  callback: Callback<T>;
  rejecter: Rejecter<T>;

  constructor(
    p: Partial<Pick<GrammarRule<T>, "callback" | "rejecter">> &
      Pick<GrammarRule<T>, "rule" | "NT">
  ) {
    p.callback ??= () => {};
    p.rejecter ??= () => false;

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

export interface ReducerContext<T> {
  readonly matched: ASTNode<T>[];
  readonly before: ASTNode<T>[];
  readonly after: ASTNode<T>[];
  /** Data of the result AST node. */
  data?: T;
  error?: any;
}

/** Will be called if the current grammar is accepted. */
export type Callback<T> = (context: ReducerContext<T>) => void;

/** Grammar rejecter. Return `true` to reject to use the current grammar. */
export type Rejecter<T> = (context: ReducerContext<T>) => boolean;

/** A set of different grammars. */
export class GrammarSet {
  /** Grammars. */
  private gs: Grammar[];

  constructor() {
    this.gs = [];
  }

  has<_>(g: Grammar | ASTNode<_> | TempGrammar) {
    return !this.gs.every((gg) => !gg.eq(g));
  }

  /** Return `true` if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.push(g);
    return true;
  }

  map<R>(f: (g: Grammar) => R) {
    return this.gs.map(f);
  }

  /** Return a list of grammars that in both `this` and `gs`. */
  overlap(gs: GrammarSet) {
    return this.gs.filter((g) => gs.has(g));
  }
}
