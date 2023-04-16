import { ILexer } from "../../../lexer";
import { ASTNode, Traverser } from "../../ast";
import { LR_RuntimeError } from "../error";
import { Callback, Condition } from "./context";
import { ruleEndsWith, ruleStartsWith } from "./util";

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
  /**
   * The name of the grammar.
   * By default the value is equal to the type name(this.content).
   * The name is only used in ASTNode query selector.
   */
  name: string;

  private constructor(p: Pick<Grammar, "type" | "content" | "name">) {
    Object.assign(this, p);
  }

  static T(content: string, name?: string) {
    return new Grammar({ type: GrammarType.T, content, name: name ?? content });
  }
  static NT(content: string, name?: string) {
    return new Grammar({
      type: GrammarType.NT,
      content,
      name: name ?? content,
    });
  }
  static Literal(content: string) {
    // literals don't have a name
    return new Grammar({ type: GrammarType.LITERAL, content, name: "" });
  }

  /** Equals to. */
  eq<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
    if (g instanceof Grammar)
      return this.type == g.type && this.content == g.content;
    else if (g instanceof ASTNode)
      return this.type == GrammarType.LITERAL
        ? // check literal content
          this.content == g.text
        : // check type name
          this.content == g.type;
  }

  /** Lexer is used to parse literal value's type name. */
  toASTNode<T>(lexer: ILexer) {
    if (this.type == GrammarType.LITERAL) {
      const token = lexer.dryClone().lex(this.content);
      if (token === null) throw LR_RuntimeError.invalidLiteral(this.content);
      return new ASTNode<T>({
        type: token.type,
        text: this.content,
        start: 0,
      });
    } else return new ASTNode<T>({ type: this.content, start: 0 });
  }

  /** Return `type name` or `'literal value'` */
  toString() {
    return this.type == GrammarType.LITERAL
      ? // literal content
        `'${this.content}'`
      : // type name
        this.content;
  }
}

export class GrammarRule<T> {
  readonly rule: readonly Grammar[];
  /** The reduce target. */
  readonly NT: string;
  callback: Callback<T>;
  rejecter: Condition<T>;
  rollback: Callback<T>;
  commit: Condition<T>;
  traverser?: Traverser<T>;

  constructor(
    p: Pick<
      GrammarRule<T>,
      | "rule"
      | "NT"
      | "callback"
      | "rejecter"
      | "rollback"
      | "commit"
      | "traverser"
    >
  ) {
    Object.assign(this, p);
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: Readonly<GrammarRule<T>>) {
    const result = [] as {
      reducerRule: Readonly<GrammarRule<T>>;
      shifterRule: Readonly<GrammarRule<T>>;
      /** How many grammars are overlapped in rule. */
      length: number;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        ruleStartsWith(another.rule, this.rule.slice(i)) &&
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
  checkRRConflict(another: Readonly<GrammarRule<T>>) {
    return ruleEndsWith(this.rule, another.rule);
  }

  /** Return ``{ NT: `grammar rules` }``. */
  toString(formatter?: (NT: string, grammars: readonly string[]) => string) {
    return GrammarRule.getString(this, formatter);
  }

  /** Return ``{ NT: `grammar rules` }``. */
  static getString(
    gr: { NT: string; rule: readonly Grammar[] },
    formatter?: (NT: string, grammars: readonly string[]) => string
  ) {
    formatter ??= (NT, grammars) => `{ ${NT}: \`${grammars.join(" ")}\` }`;

    return formatter(
      gr.NT,
      gr.rule.map((g) => g.toString())
    );
  }
}

/** A set of different grammars. */
export class GrammarSet /* implements Iterable<Grammar> */ {
  /** Grammars. */
  private gs: Grammar[];

  constructor() {
    this.gs = [];
  }

  // [Symbol.iterator](): Iterator<Grammar, any, undefined> {
  //   return this.gs[Symbol.iterator]();
  // }

  has<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
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
  overlap(gs: Readonly<GrammarSet>) {
    return this.gs.filter((g) => gs.has(g));
  }
}
