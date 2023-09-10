import { Traverser } from "../../../ast";
import { StringCache } from "../../../cache";
import {
  Conflict,
  ConflictType,
  ResolvedConflict,
  ResolverHydrationId,
} from "../conflict";
import { Callback, Condition } from "../context";
import { ruleStartsWith, ruleEndsWith } from "../util";
import { Grammar } from "./grammar";
import { GrammarRepo } from "./grammar-repo";
import { GrammarRuleRepo } from "./grammar-rule-repo";
import { GrammarSet } from "./grammar-set";

// only for js doc
import type { ParserBuilder } from "../../builder";

export class GrammarRule<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> {
  readonly rule: readonly Grammar[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: Kinds;
  /**
   * A list of conflicts when the grammar rule wants to reduce.
   * All conflicts must be resolved before the DFA can be built.
   * This will be evaluated during the parsing process.
   */
  readonly conflicts: (Conflict<ASTData, Kinds, LexerKinds> & {
    /**
     * Related resolvers.
     */
    resolvers: ResolvedConflict<ASTData, Kinds, LexerKinds>[];
  })[];
  /**
   * A list of resolved conflicts.
   * All conflicts must be resolved by this before the DFA can be built.
   * This will be evaluated by candidate during parsing.
   */
  readonly resolved: ResolvedConflict<ASTData, Kinds, LexerKinds>[];
  callback?: Callback<ASTData, Kinds, LexerKinds>;
  rejecter?: Condition<ASTData, Kinds, LexerKinds>;
  rollback?: Callback<ASTData, Kinds, LexerKinds>;
  commit?: Condition<ASTData, Kinds, LexerKinds>;
  traverser?: Traverser<ASTData, Kinds | LexerKinds>;

  /**
   * @see {@link GrammarRule.toString}
   */
  readonly str: StringCache;
  /**
   * @see {@link GrammarRule.getStrWithGrammarName}
   */
  readonly strWithGrammarName: StringCache;
  /**
   * @see {@link GrammarRule.getStrWithoutGrammarName}
   */
  readonly strWithoutGrammarName: StringCache;
  /**
   * The index of {@link ParserBuilder.data}
   */
  readonly hydrationId: number;

  constructor(
    p: Pick<
      GrammarRule<ASTData, Kinds, LexerKinds>,
      | "rule"
      | "NT"
      | "callback"
      | "rejecter"
      | "rollback"
      | "commit"
      | "traverser"
      | "hydrationId"
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
    this.hydrationId = p.hydrationId;
  }

  /**
   * Check if the tail of this's rule is the same as the head of another.
   * Which means this rule want's to reduce, and another rule want's to shift.
   */
  checkRSConflict(another: Readonly<GrammarRule<ASTData, Kinds, LexerKinds>>) {
    const result = [] as {
      shifterRule: Pick<
        Conflict<ASTData, Kinds, LexerKinds>,
        "anotherRule"
      >["anotherRule"];
      overlapped: Extract<
        Pick<Conflict<ASTData, Kinds, LexerKinds>, "overlapped">["overlapped"],
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
  checkRRConflict(another: Readonly<GrammarRule<ASTData, Kinds, LexerKinds>>) {
    return ruleEndsWith(this.rule, another.rule);
  }

  /**
   * For debug output.
   */
  toString() {
    return this.str.value;
  }

  /**
   * Return ``{ NT: `grammar rules with name` }``.
   */
  static getStrWithGrammarName(
    gr: Pick<GrammarRule<any, any, any>, "NT" | "rule">
  ) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithName)
      .join(" ")}\` }`;
  }

  /**
   * Return ``{ NT: `grammar rules without name` }``.
   */
  static getStrWithoutGrammarName(
    gr: Pick<GrammarRule<any, any, any>, "NT" | "rule">
  ) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithoutName.value)
      .join(" ")}\` }`;
  }

  toJSON(
    repo: GrammarRepo,
    grs: GrammarRuleRepo<ASTData, Kinds, LexerKinds>
  ): {
    // TODO: why the return type has to be typed explicitly?
    // if without this type, got: src/parser/ELR/model/grammar/grammar-rule.ts:140:3 - error TS7023: 'toJSON' implicitly has return type 'any' because it does not have a return type annotation and is referenced directly or indirectly in one of its return expressions.
    NT: string;
    rule: string[];
    conflicts: {
      type: ConflictType;
      anotherRule: string;
      next: string[];
      handleEnd: boolean;
      overlapped: number | undefined;
      resolvers: number[];
    }[];
    resolved: {
      type: ConflictType;
      anotherRule: string;
      handleEnd: boolean;
      next: string[] | "*";
      hydrationId: ResolverHydrationId;
    }[];
    str: string;
    strWithGrammarName: string;
    strWithoutGrammarName: string;
    hydrationId: number;
  } {
    return {
      NT: this.NT,
      rule: this.rule.map((g) => repo.getKey(g)),
      conflicts: this.conflicts.map((c) => ({
        type: c.type,
        anotherRule: grs.getKey(c.anotherRule),
        next: c.next.map((g) => repo.getKey(g)),
        handleEnd: c.handleEnd,
        overlapped: c.overlapped,
        resolvers: c.resolvers.map((r) => this.resolved.indexOf(r)),
      })),
      resolved: this.resolved.map((r) => ({
        type: r.type,
        anotherRule: grs.getKey(r.anotherRule),
        handleEnd: r.handleEnd,
        next:
          r.next == "*" ? ("*" as const) : r.next.map((g) => repo.getKey(g)),
        // accepter
        hydrationId: r.hydrationId,
      })),
      str: this.str.value,
      strWithGrammarName: this.strWithGrammarName.value,
      strWithoutGrammarName: this.strWithoutGrammarName.value,
      hydrationId: this.hydrationId,
    };
  }

  static fromJSON<ASTData, Kinds extends string, LexerKinds extends string>(
    data: ReturnType<GrammarRule<ASTData, Kinds, LexerKinds>["toJSON"]>,
    repo: GrammarRepo
  ) {
    const gr = new GrammarRule<ASTData, Kinds, LexerKinds>({
      rule: data.rule.map((r) => repo.getByString(r)!),
      NT: data.NT as Kinds,
      hydrationId: data.hydrationId,
    });
    gr.str.value = data.str;
    gr.strWithGrammarName.value = data.strWithGrammarName;
    gr.strWithoutGrammarName.value = data.strWithoutGrammarName;

    // restore conflicts & resolvers after the whole grammar rule repo is filled.
    const restoreConflicts = (
      grs: GrammarRuleRepo<ASTData, Kinds, LexerKinds>
    ) => {
      gr.resolved.push(
        ...data.resolved.map((r) => ({
          type: r.type,
          anotherRule: grs.getByString(r.anotherRule)!,
          handleEnd: r.handleEnd,
          next:
            r.next == "*"
              ? ("*" as const)
              : new GrammarSet(r.next.map((g) => repo.getByString(g)!)),
          accepter: false, // accepter will be restored when hydrate
          hydrationId: r.hydrationId,
        }))
      );
      gr.conflicts.push(
        ...data.conflicts.map((c) => ({
          type: c.type,
          anotherRule: grs.getByString(c.anotherRule)!,
          next: new GrammarSet(c.next.map((g) => repo.getByString(g)!)),
          handleEnd: c.handleEnd,
          overlapped: c.overlapped,
          resolvers: c.resolvers.map((i) => gr.resolved[i]),
        }))
      );
    };

    return { gr, restoreConflicts };
  }
}
