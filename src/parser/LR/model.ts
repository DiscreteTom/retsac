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

export class Grammar {
  type: GrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;

  constructor(p: Pick<Grammar, "type" | "content">) {
    Object.assign(this, p);
  }

  /** Equals to. */
  eq<_>(g: Grammar | ASTNode<_>) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else if (g instanceof ASTNode)
      return this.type == GrammarType.LITERAL
        ? // check literal content
          this.content == g.text
        : // check type name
          this.content == g.type;
  }

  /** Return `type name` or `"literal"` */
  toString() {
    return this.type == GrammarType.LITERAL
      ? // literal content
        `'${this.content}'`
      : // type name
        this.content;
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

  /** Return whether this.rule starts with another rule. */
  private ruleStartsWith(anotherRule: Grammar[]) {
    if (this.rule.length < anotherRule.length) return false;
    for (let i = 0; i < anotherRule.length; i++) {
      if (!this.rule[i].eq(anotherRule[i])) return false;
    }
    return true;
  }

  /** Return whether this.rule ends with `anotherRule`. */
  private ruleEndsWith(anotherRule: Grammar[]) {
    if (this.rule.length < anotherRule.length) return false;
    for (let i = 0; i < anotherRule.length; i++) {
      if (!this.rule.at(-i - 1)!.eq(anotherRule.at(-i - 1)!)) return false;
    }
    return true;
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: GrammarRule<T>) {
    const result = [] as {
      reducerRule: GrammarRule<T>;
      shifterRule: GrammarRule<T>;
      /** How many grammars are overlapped in rule. */
      length: number;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        another.ruleStartsWith(this.rule.slice(i)) &&
        // if the tail of this rule is the same as another's whole rule, it's a reduce-reduce conflict.
        // e.g. `A B C | B C`
        this.rule.length - i != another.rule.length
      ) {
        result.push({
          reducerRule: this,
          shifterRule: another,
          length: this.rule.length - i,
        });
      }
    }
    return result;
  }

  /** Check if the tail of this's rule is the same as another's whole rule. */
  checkRRConflict(another: GrammarRule<T>) {
    return this.ruleEndsWith(another.rule);
  }

  /** Return `NT <= grammar rules`. */
  toString(formatter?: (NT: string, grammars: string[]) => string) {
    formatter ??= (NT, grammars) => `{ ${NT}: \`${grammars.join(" ")}\` }`;

    return formatter(
      this.NT,
      this.rule.map((g) => g.toString())
    );
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

  has<_>(g: Grammar | ASTNode<_>) {
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
