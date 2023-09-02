import { ASTNode, Traverser } from "../../ast";
import { Conflict } from "./conflict";
import { Callback, Condition } from "./context";
import { ruleEndsWith, ruleStartsWith } from "./util";

export enum GrammarType {
  /**
   * Literal string.
   * The literal value must be able to be lexed to get the kind name.
   */
  LITERAL,
  /**
   * Terminator, which means the grammar's kind name should be defined in lexer.
   */
  T,
  /**
   * Non-terminator, which means the grammar's kind name should be defined in parser.
   */
  NT,
}

export class Grammar {
  readonly type: GrammarType;
  /**
   * The kind name.
   * For literal, the kind name is calculated by lexer.
   */
  readonly kind: string;
  /**
   * The literal value if this is a literal.
   */
  readonly text?: string;
  /**
   * The name of the grammar.
   * By default it's the same as the kind name.
   */
  readonly name: string;

  private constructor(p: Pick<Grammar, "type" | "kind" | "name" | "text">) {
    this.type = p.type;
    this.kind = p.kind;
    this.name = p.name;
    this.text = p.text;
  }

  /**
   * Create a T grammar.
   */
  static T(kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.T,
      kind,
      name: name ?? kind,
    });
  }
  /**
   * Create a NT grammar.
   */
  static NT(kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.NT,
      kind,
      name: name ?? kind,
    });
  }
  /**
   * Create a literal grammar.
   */
  static Literal(text: string, kind: string, name?: string) {
    return new Grammar({
      type: GrammarType.LITERAL,
      kind,
      name: name ?? kind,
      text,
    });
  }

  /**
   * Check if the grammar is equal to another.
   * This is used in conflict detection, so we don't need to check the name.
   */
  eq<_>(g: Readonly<Grammar>) {
    return (
      this == g || // same object
      (this.type == g.type &&
        (this.type == GrammarType.LITERAL
          ? this.text == g.text // if text is the same, the kind must be the same
          : this.kind == g.kind))
    );
  }

  /**
   * Check if the grammar's kind match the ASTNode's kind.
   * For literal, the text is also checked.
   */
  match(node: Readonly<ASTNode<any>>) {
    // we don't need to check the name
    // because the name is set by the grammar after the grammar is matched
    return this.type == GrammarType.LITERAL
      ? // check literal content
        this.text == node.text && this.kind == node.kind
      : // check kind name
        this.kind == node.kind;
  }

  /**
   * This is used when calculate all DFA state.
   * The result will be cached to prevent duplicated calculation.
   */
  toMockASTNode() {
    return (
      this.node ??
      (this.node = new ASTNode({
        kind: this.kind,
        text: this.text,
        start: 0,
        // don't set name, since the name is set by the parent node
      }))
    );
  }
  private node?: Readonly<ASTNode<any>>;

  /**
   * Format: `kind(name): text`.
   * The result will be cached for future use.
   */
  toString() {
    return this.str ?? (this.str = ASTNode.getString(this));
  }
  private str?: string;

  /**
   * Format: `kind: text`.
   * The result is suitable to be a key in a map.
   * The result is lazy and cached.
   */
  toUniqueString() {
    return this.uniqueStr ?? (this.uniqueStr = ASTNode.getUniqueString(this));
  }
  private uniqueStr?: string;

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * This is used to generate grammar rule string.
   */
  toGrammarString() {
    return (
      this.grammarStr ??
      (this.grammarStr =
        (this.type == GrammarType.LITERAL
          ? JSON.stringify(this.text)
          : this.kind) + (this.name == this.kind ? "" : "@" + this.name))
    );
  }
  private grammarStr?: string;
}

export class GrammarRule<T> {
  readonly rule: readonly Grammar[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: string;
  readonly conflicts: Conflict<T>[];
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
    this.rule = p.rule;
    this.NT = p.NT;
    this.callback = p.callback;
    this.rejecter = p.rejecter;
    this.rollback = p.rollback;
    this.commit = p.commit;
    this.traverser = p.traverser;
    this.conflicts = [];
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
  private str?: string;

  /** Return ``{ NT: `grammar rules` }``. */
  static getString(gr: { NT: string; rule: readonly Grammar[] }) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.toGrammarString())
      .join(" ")}\` }`;
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
    if (g instanceof Grammar) return this.gs.has(g.toUniqueString()); // Grammar
    return this.gs.has((g as Readonly<ASTNode<_>>).kind); // ASTNode, check kind name
  }

  /** Return `true` if successfully added. */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.set(g.toUniqueString(), g);
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
