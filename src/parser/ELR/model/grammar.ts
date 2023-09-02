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

  /**
   * Only GrammarRepo should use this constructor.
   */
  constructor(
    p: Pick<Grammar, "type" | "kind" | "name" | "text" | "strWithName">
  ) {
    this.type = p.type;
    this.kind = p.kind;
    this.name = p.name;
    this.text = p.text;
    this.strWithName = p.strWithName;
  }

  /**
   * Check if the grammar is equal to another.
   * This is used in conflict detection, so we don't need to check the name.
   */
  // TODO: maybe this is not needed? since we have GrammarRepo to deduplicate
  eq(g: Readonly<Grammar>) {
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

    // if literal, check the text. if not, the text is undefined, so it's ok to directly check `this.text` and `node.text`
    return this.text == node.text && this.kind == node.kind;
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
   * Format: `kind: text`.
   * This is lazy and cached.
   */
  toString() {
    return this.str ?? (this.str = Grammar.getString(this));
  }
  private str?: string;
  /**
   * Format: `kind: text`.
   */
  static getString(data: Pick<Grammar, "kind" | "text">) {
    return ASTNode.getString(data);
  }

  /**
   * Format: `kind(name): text`.
   */
  toStringWithName() {
    return this.strWithName;
  }
  /**
   * Format: `kind(name): text`.
   * This should be set in constructor by the GrammarRepo.
   */
  readonly strWithName: string;
  /**
   * Format: `kind(name): text`.
   */
  static getStringWithName(data: Pick<Grammar, "kind" | "name" | "text">) {
    return ASTNode.getStringWithName(data);
  }

  /**
   * Format: `kind` if not literal, else `"text"`.
   * This is used to generate grammar rule string without name.
   * This is lazy and cached.
   */
  toGrammarString() {
    return (
      this.grammarStr ?? (this.grammarStr = Grammar.getGrammarString(this))
    );
  }
  private grammarStr?: string;
  /**
   * Format: `kind` if not literal, else `"text"`.
   */
  static getGrammarString(data: Pick<Grammar, "type" | "kind" | "text">) {
    return data.type == GrammarType.LITERAL
      ? JSON.stringify(data.text)
      : data.kind;
  }

  /**
   * Format: `kind@name` if not literal, else `"text"@name`.
   * This is used to generate grammar rule string with name.
   * This is lazy and cached.
   */
  toGrammarStringWithName() {
    return (
      this.grammarStrWithName ??
      (this.grammarStrWithName = Grammar.getGrammarStringWithName(this))
    );
  }
  private grammarStrWithName?: string;
  static getGrammarStringWithName(
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
      shifterRule: Pick<Conflict<T>, "anotherRule">["anotherRule"];
      overlapped: Extract<
        Pick<Conflict<T>, "overlapped">["overlapped"],
        number
      >;
    }[];
    for (let i = 0; i < this.rule.length; ++i) {
      if (
        ruleStartsWith(another.rule, this.rule.slice(i)) &&
        // if the tail of this rule is the same as another's whole rule, it's a reduce-reduce conflict.
        // e.g. `A B C | B C`
        this.rule.length - i != another.rule.length
      ) {
        result.push({
          shifterRule: another,
          overlapped: this.rule.length - i,
        });
      }
    }
    return result;
  }

  /**
   * Check if the tail of this's rule is the same as another's whole rule.
   */
  checkRRConflict(another: Readonly<GrammarRule<T>>) {
    return ruleEndsWith(this.rule, another.rule);
  }

  /**
   * Return the grammar string: ``{ NT: `grammar rules` }``.
   * Grammar's name is NOT included.
   * This is lazy and cached.
   */
  toString() {
    return this.str ?? (this.str = GrammarRule.getString(this));
  }
  private str?: string;
  /**
   * Return ``{ NT: `grammar rules` }``.
   * Grammar's name is NOT included.
   */
  static getString(gr: Pick<GrammarRule<any>, "NT" | "rule">) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.toGrammarString())
      .join(" ")}\` }`;
  }

  /**
   * Return the grammar string: ``{ NT: `grammar rules` }``.
   * Grammar's name is included.
   * This is lazy and cached.
   */
  toStringWithGrammarName() {
    return (
      this.strWithGrammarName ??
      (this.strWithGrammarName = GrammarRule.getStringWithGrammarName(this))
    );
  }
  private strWithGrammarName?: string;
  /**
   * Return ``{ NT: `grammar rules` }``.
   * Grammar's name is included.
   */
  static getStringWithGrammarName(gr: Pick<GrammarRule<any>, "NT" | "rule">) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.toGrammarStringWithName())
      .join(" ")}\` }`;
  }
}

/**
 * A set of different grammars, ignore the name.
 * This is used when the name of grammar is NOT needed.
 * E.g. DFA's first/follow sets.
 */
export class GrammarSet {
  /**
   * Grammars. `grammar's unique string => grammar`
   */
  private gs: Map<string, Grammar>;

  constructor() {
    this.gs = new Map();
  }

  get grammars() {
    return this.gs as ReadonlyMap<string, Grammar>;
  }

  /**
   * Return `true` if successfully added(g is not in this before), else `false`.
   */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.set(g.toString(), g);
    return true;
  }

  has(g: Readonly<Grammar> | Readonly<ASTNode<any>>) {
    return this.gs.has(g.toString()); // Grammar & ASTNode has the same string format
  }

  map<T>(callback: (g: Grammar) => T) {
    const res = [] as T[];
    this.gs.forEach((g) => res.push(callback(g)));
    return res;
  }

  /**
   * Return a list of grammars that in both `this` and `gs`.
   */
  overlap(gs: Readonly<GrammarSet>) {
    const result = [] as Grammar[];
    this.gs.forEach((g) => {
      if (gs.has(g)) result.push(g);
    });
    return result;
  }
}

/**
 * A set of different grammars, include the name.
 * This is used to manage the creation of grammars, to prevent creating the same grammar twice.
 */
export class GrammarRepo {
  /**
   * Grammars. `grammar's string => grammar`
   */
  private gs: Map<string, Grammar>;

  constructor() {
    this.gs = new Map();
  }

  get(str: string) {
    return this.gs.get(str);
  }

  /**
   * Get or create a T grammar.
   */
  T(kind: string, name?: string) {
    name = name ?? kind;
    const str = Grammar.getStringWithName({ kind, name });
    const res = this.get(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.T,
      kind,
      name,
      strWithName: str,
    });
    this.gs.set(str, g);
    return g;
  }

  /**
   * Get or create a NT grammar.
   */
  NT(kind: string, name?: string) {
    name = name ?? kind;
    const str = Grammar.getStringWithName({ kind, name });
    const res = this.get(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.NT,
      kind,
      name,
      strWithName: str,
    });
    this.gs.set(str, g);
    return g;
  }

  /**
   * Get or create a literal grammar.
   */
  Literal(text: string, kind: string, name?: string) {
    name = name ?? kind;
    const str = Grammar.getStringWithName({ kind, name, text });
    const res = this.get(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.LITERAL,
      kind,
      name,
      text,
      strWithName: str,
    });
    this.gs.set(str, g);
    return g;
  }
}
