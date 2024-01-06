import type { NTNodeTraverser } from "../../../traverser";
import type { Conflict, ResolvedConflict } from "../conflict";
import type { Callback, Condition } from "../context";
import type { Grammar } from "./grammar";
import type { GrammarRepo } from "./grammar-repo";
import type { ReadonlyGrammarRuleRepo } from "./grammar-rule-repo";
import { GrammarSet } from "./grammar-set";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ParserBuilder } from "../../builder";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  Token,
} from "../../../../lexer";

export class GrammarRule<
  NT extends NTs, // the target NT
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  readonly rule: readonly Grammar<NTs | ExtractKinds<LexerDataBindings>>[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: NT;
  /**
   * A list of conflicts when the grammar rule wants to reduce.
   * All conflicts must be resolved before the DFA can be built.
   * This will be evaluated during the parsing process.
   */
  readonly conflicts: (Conflict<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  > & {
    /**
     * Related resolvers.
     */
    resolvers: ResolvedConflict<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >[];
  })[];
  /**
   * A list of resolved conflicts.
   * All conflicts must be resolved by this before the DFA can be built.
   * This will be evaluated by candidate during parsing.
   */
  readonly resolved: ResolvedConflict<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >[];
  callback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  rejecter?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  commit?: Condition<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  traverser?: NTNodeTraverser<
    NT,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;

  /**
   * Format: `NT:grammar,...`.
   * This is used in {@link ReadonlyGrammarRuleRepo} when build DFA.
   */
  readonly id: string;
  /**
   * The index of {@link ParserBuilder.builderData}
   */
  readonly hydrationId: number;

  constructor(
    p: Pick<
      GrammarRule<
        NT,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
      | "rule"
      | "NT"
      | "callback"
      | "rejecter"
      | "rollback"
      | "commit"
      | "traverser"
      | "hydrationId"
    > &
      // restored from JSON
      Partial<
        Pick<
          GrammarRule<
            NT,
            NTs,
            ASTData,
            ErrorType,
            LexerDataBindings,
            LexerActionState,
            LexerErrorType
          >,
          "id"
        >
      >,
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

    this.id = p.id ?? GrammarRule.generateId(p);
    this.hydrationId = p.hydrationId;
  }

  /**
   * @see {@link GrammarRule.id}.
   */
  static generateId(
    data: Readonly<{ NT: string; rule: readonly { grammarString: string }[] }>,
  ) {
    return `${data.NT}:${data.rule.map((g) => g.grammarString).join(",")}`;
  }

  /**
   * For debug output.
   *
   * Format: `GrammarRule({ NT, rule })`.
   */
  toString() {
    return `GrammarRule(${JSON.stringify({
      NT: this.NT,
      rule: this.rule.map((g) => g.grammarString),
    })})`;
  }

  /**
   * Format: ``{ NT: `grammar rules with name` }``.
   */
  toGrammarRuleString() {
    return GrammarRule.getGrammarRuleString(this);
  }

  /**
   * @see {@link GrammarRule.toGrammarRuleString}.
   */
  static getGrammarRuleString(data: {
    NT: string;
    rule: readonly Readonly<{ grammarString: string }>[];
  }) {
    return `{ ${data.NT}: \`${data.rule
      .map((g) => g.grammarString)
      .join(" ")}\` }`;
  }

  toJSON() {
    return {
      NT: this.NT,
      rule: this.rule.map((g) => g.grammarString),
      conflicts: this.conflicts.map((c) => ({
        type: c.type,
        anotherRule: c.anotherRule.id,
        next: c.next.map((g) => g.grammarString),
        handleEnd: c.handleEnd,
        resolvers: c.resolvers.map((r) => this.resolved.indexOf(r)),
      })),
      resolved: this.resolved.map((r) => ({
        type: r.type,
        anotherRule: r.anotherRule.id,
        handleEnd: r.handleEnd,
        next:
          r.next === "*" ? ("*" as const) : r.next.map((g) => g.grammarString),
        accepter: r.hydrationId === undefined ? r.accepter : undefined,
        hydrationId: r.hydrationId === undefined ? undefined : r.hydrationId,
      })),
      id: this.id,
      hydrationId: this.hydrationId,
    };
  }

  static fromJSON<
    NT extends NTs,
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    data: ReturnType<
      GrammarRule<
        NT,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >["toJSON"]
    >,
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  ) {
    const gr = new GrammarRule<
      NT,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >({
      rule: data.rule.map((r) => repo.get(r)!),
      NT: data.NT as NT,
      hydrationId: data.hydrationId,
      id: data.id,
    });

    // restore conflicts & resolvers after the whole grammar rule repo is filled.
    const restoreConflicts = (
      grs: ReadonlyGrammarRuleRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
    ) => {
      gr.resolved.push(
        ...data.resolved.map((r) =>
          r.hydrationId === undefined
            ? {
                type: r.type,
                anotherRule: grs.get(r.anotherRule)!,
                handleEnd: r.handleEnd,
                next:
                  r.next === "*"
                    ? ("*" as const)
                    : new GrammarSet<NTs, ExtractKinds<LexerDataBindings>>(
                        r.next.map((g) => repo.get(g)!),
                      ),
                accepter: r.accepter!,
                hydrationId: undefined,
              }
            : {
                type: r.type,
                anotherRule: grs.get(r.anotherRule)!,
                handleEnd: r.handleEnd,
                next:
                  r.next === "*"
                    ? ("*" as const)
                    : new GrammarSet<NTs, ExtractKinds<LexerDataBindings>>(
                        r.next.map((g) => repo.get(g)!),
                      ),
                // accepter will be restored when hydrate if hydration id is provided.
                accepter: () => true,
                hydrationId: r.hydrationId,
              },
        ),
      );
      gr.conflicts.push(
        ...data.conflicts.map((c) => ({
          type: c.type,
          anotherRule: grs.get(c.anotherRule)!,
          next: new GrammarSet<NTs, ExtractKinds<LexerDataBindings>>(
            c.next.map((g) => repo.get(g)!),
          ),
          handleEnd: c.handleEnd,
          resolvers: c.resolvers.map((i) => gr.resolved[i]),
        })),
      );
    };

    return { gr, restoreConflicts };
  }
}
