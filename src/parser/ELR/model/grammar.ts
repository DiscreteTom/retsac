import { ASTNode, Traverser } from "../../ast";
import { Conflict, ResolvedConflict } from "./conflict";
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
   * This is lazy and cached.
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
   * The result is suitable to be a key in a map if the name is needed.
   * This is lazy and cached.
   */
  toString() {
    return this.str ?? (this.str = Grammar.getString(this));
  }
  private str?: string;
  /**
   * Format: `kind(name): text`.
   */
  static getString(data: Pick<Grammar, "kind" | "name" | "text">) {
    return ASTNode.getString(data);
  }

  /**
   * Format: `kind: text`.
   * The result is suitable to be a key in a map if the name is NOT needed.
   * This is lazy and cached.
   */
  toUniqueString() {
    return this.uniqueStr ?? (this.uniqueStr = Grammar.getUniqueString(this));
  }
  private uniqueStr?: string;
  /**
   * Format: `kind: text`.
   */
  static getUniqueString(data: Pick<Grammar, "kind" | "text">) {
    return ASTNode.getUniqueString(data);
  }

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * This is used to generate grammar rule string.
   * This is lazy and cached.
   */
  toGrammarString() {
    return (
      this.grammarStr ?? (this.grammarStr = Grammar.getGrammarString(this))
    );
  }
  private grammarStr?: string;
  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   */
  static getGrammarString(
    data: Pick<Grammar, "type" | "kind" | "name" | "text">
  ) {
    return (
      (data.type == GrammarType.LITERAL
        ? JSON.stringify(data.text)
        : data.kind) + (data.name == data.kind ? "" : "@" + data.name)
    );
  }
}

export class GrammarRule<T> {
  readonly rule: readonly Grammar[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: string;
  /**
   * A list of conflicts when the grammar rule wants to reduce.
   * All conflicts must be resolved before the DFA can be built.
   * This will NOT be evaluated during parsing, just to record conflicts.
   */
  readonly conflicts: Conflict<T>[];
  /**
   * A list of resolved conflicts.
   * All conflicts must be resolved by this before the DFA can be built.
   * This will be evaluated by candidate during parsing.
   */
  readonly resolved: ResolvedConflict<T>[];
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
    this.resolved = [];
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
