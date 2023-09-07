import { Traverser } from "../../../ast";
import { StringCache } from "../../../cache";
import { Conflict, ResolvedConflict } from "../conflict";
import { Callback, Condition } from "../context";
import { ruleStartsWith, ruleEndsWith } from "../util";
import { Grammar } from "./grammar";
import { GrammarRepo } from "./grammar-repo";
import { GrammarRuleRepo } from "./grammar-rule-repo";

export class GrammarRule<ASTData, Kinds extends string> {
  readonly rule: readonly Grammar[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: Kinds;
  /**
   * A list of conflicts when the grammar rule wants to reduce.
   * All conflicts must be resolved before the DFA can be built.
   * This will NOT be evaluated during parsing, just to record conflicts.
   */
  readonly conflicts: Conflict<ASTData, Kinds>[];
  /**
   * A list of resolved conflicts.
   * All conflicts must be resolved by this before the DFA can be built.
   * This will be evaluated by candidate during parsing.
   */
  readonly resolved: ResolvedConflict<ASTData, Kinds>[];
  callback?: Callback<ASTData, Kinds>;
  rejecter?: Condition<ASTData, Kinds>;
  rollback?: Callback<ASTData, Kinds>;
  commit?: Condition<ASTData, Kinds>;
  traverser?: Traverser<ASTData, Kinds>;

  /**
   * For debug output.
   */
  readonly str: StringCache;
  /**
   * Return ``{ NT: `grammar rules with name` }``.
   */
  readonly strWithGrammarName: StringCache;
  /**
   * Return ``{ NT: `grammar rules without name` }``.
   */
  readonly strWithoutGrammarName: StringCache;

  constructor(
    p: Pick<
      GrammarRule<ASTData, Kinds>,
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

    this.str = new StringCache(() => this.strWithGrammarName.value);
    this.strWithGrammarName = new StringCache(() =>
      GrammarRule.getStrWithGrammarName(this)
    );
    this.strWithoutGrammarName = new StringCache(() =>
      GrammarRule.getStrWithoutGrammarName(this)
    );
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: Readonly<GrammarRule<ASTData, Kinds>>) {
    const result = [] as {
      shifterRule: Pick<Conflict<ASTData, Kinds>, "anotherRule">["anotherRule"];
      overlapped: Extract<
        Pick<Conflict<ASTData, Kinds>, "overlapped">["overlapped"],
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
  checkRRConflict(another: Readonly<GrammarRule<ASTData, Kinds>>) {
    return ruleEndsWith(this.rule, another.rule);
  }

  /**
   * @see {@link GrammarRule.str}
   */
  toString() {
    return this.str.value;
  }

  /**
   * @see {@link GrammarRule.strWithGrammarName}
   */
  static getStrWithGrammarName(gr: Pick<GrammarRule<any, any>, "NT" | "rule">) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithName)
      .join(" ")}\` }`;
  }

  /**
   * @see {@link GrammarRule.strWithoutGrammarName}
   */
  static getStrWithoutGrammarName(
    gr: Pick<GrammarRule<any, any>, "NT" | "rule">
  ) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithoutName.value)
      .join(" ")}\` }`;
  }

  // TODO: type this
  toSerializable(repo: GrammarRepo, grs: GrammarRuleRepo<any, any>): any {
    return {
      NT: this.NT,
      rule: this.rule.map((g) => repo.getKey(g)),
      conflicts: this.conflicts.map((c) => ({
        type: c.type,
        anotherRule: grs.getKey(c.anotherRule),
        next: c.next.map((g) => repo.getKey(g)),
        handleEnd: c.handleEnd,
        overlapped: c.overlapped,
      })),
      resolved: this.resolved.map((r) => ({
        type: r.type,
        anotherRule: grs.getKey(r.anotherRule),
        handleEnd: r.handleEnd,
        next: r.next == "*" ? "*" : r.next.map((g) => repo.getKey(g)),
        // accepter
      })),
      str: this.str.value,
      strWithGrammarName: this.strWithGrammarName.value,
      strWithoutGrammarName: this.strWithoutGrammarName.value,
    };
  }
}
