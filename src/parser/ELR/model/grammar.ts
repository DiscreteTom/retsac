import { ILexer } from "../../../lexer";
import { ASTNode, Traverser } from "../../ast";
import { LR_RuntimeError } from "../error";
import { Callback, Condition } from "./context";
import { ruleEndsWith, ruleStartsWith } from "./util";

export enum GrammarType {
  /**
   * Literal string.
   * The literal value must be able to be lexed to get the type name.
   */
  LITERAL,
  /**
   * Terminator, which means the grammar's type name should be defined in lexer.
   */
  T,
  /**
   * Non-terminator, which means the grammar's type name should be defined in parser.
   */
  NT,
}

export class Grammar {
  readonly type: GrammarType;
  /**
   * The type name.
   */
  readonly content: string; // TODO: rename to kind
  /**
   * The literal value if this is a literal.
   */
  readonly text?: string;
  /**
   * The name of the grammar.
   * By default the value is equal to T/NT's type name.
   * For literal, the name is calculated by lexer.
   */
  readonly name: string;
  /**
   * Cache the string representation.
   */
  private str?: string;
  /**
   * Cache the temporary ast node.
   */
  private node?: Readonly<ASTNode<any>>;

  private constructor(p: Pick<Grammar, "type" | "content" | "name" | "text">) {
    this.type = p.type;
    this.content = p.content;
    this.name = p.name;
    this.text = p.text;
  }

  /**
   * Create a T grammar.
   */
  static T(kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.T,
      content: kind,
      name: name ?? kind,
    });
  }
  /**
   * Create a NT grammar.
   */
  static NT(kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.NT,
      content: kind,
      name: name ?? kind,
    });
  }
  /**
   * Create a literal grammar.
   */
  static Literal(text: string, kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.LITERAL,
      content: kind,
      name: name ?? kind,
      text,
    });
  }

  /**
   * Equals to.
   */
  eq<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
    if (g instanceof Grammar)
      return (
        this == g || // same object
        (this.type == g.type && this.content == g.content) // TODO: check name?
      );
    else
      return this.type == GrammarType.LITERAL // TODO: check name?
        ? // check literal content
          this.content == (g as Readonly<ASTNode<_>>).text
        : // check type name
          this.content == (g as Readonly<ASTNode<_>>).type;
  }

  /**
   * This function is used to create temporary ASTNode for comparison.
   * The result will be cached to prevent duplicated calculation.
   */
  toTempASTNode() {
    if (this.node) return this.node;
    if (this.type == GrammarType.LITERAL) {
      // const token = lexer.dryClone().lex(this.content);
      // if (token === null) throw LR_RuntimeError.invalidLiteral(this.content);
      return (this.node = new ASTNode({
        type: this.content,
        text: this.text,
        start: 0,
      }));
    } else return (this.node = new ASTNode({ type: this.content, start: 0 }));
  }

  /**
   * Return `type name` or `"literal value"`.
   * The result will be cached for future use.
   */
  toString() {
    return (
      this.str ??
      (this.str =
        this.type == GrammarType.LITERAL
          ? // literal content
            JSON.stringify(this.content)
          : // type name
            this.content)
    );
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
  /** Cache the string representation. */
  private str?: string;
  // TODO: add a `conflicts` field, #7

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
  toString() {
    return this.str ?? (this.str = GrammarRule.getString(this));
  }

  /** Return ``{ NT: `grammar rules` }``. */
  static getString(gr: { NT: string; rule: readonly Grammar[] }) {
    return `{ ${gr.NT}: \`${gr.rule.map((g) => g.toString()).join(" ")}\` }`;
  }
}

/** A set of different grammars. */
export class GrammarSet {
  /** Grammars. `string exp => grammar` */
  private gs: Map<string, Grammar>;

  constructor() {
    this.gs = new Map();
  }

  has<_>(g: Readonly<Grammar> | Readonly<ASTNode<_>>) {
    // `g instanceof Grammar` and `g instanceof Readonly<Grammar>` are not working
    // so we have to use `in` operator
    if (g instanceof Grammar) return this.gs.has(g.toString()); // Grammar
    return this.gs.has((g as Readonly<ASTNode<_>>).type); // ASTNode, check type name
  }

  /** Return `true` if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.set(g.toString(), g);
    return true;
  }

  map<R>(f: (g: Grammar) => R) {
    const result = [] as R[];
    for (const g of this.gs.values()) result.push(f(g));
    return result;
  }

  forEach(f: (g: Grammar) => void) {
    for (const g of this.gs.values()) f(g);
  }

  toArray() {
    return Array.from(this.gs.values());
  }

  /** Return a list of grammars that in both `this` and `gs`. */
  overlap(gs: Readonly<GrammarSet>) {
    const result = [] as Grammar[];
    for (const g of this.gs.values()) if (gs.has(g)) result.push(g);
    return result as readonly Grammar[];
  }
}
