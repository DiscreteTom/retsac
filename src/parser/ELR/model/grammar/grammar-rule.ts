import type { Traverser } from "../../../traverser";
import { StringCache } from "../../../cache";
import type {
  Conflict,
  ConflictType,
  ResolvedConflict,
  ResolverHydrationId,
} from "../conflict";
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  readonly rule: readonly Grammar<Kinds | ExtractKinds<LexerDataBindings>>[];
  /**
   * The reduce target's kind name.
   */
  readonly NT: Kinds;
  /**
   * A list of conflicts when the grammar rule wants to reduce.
   * All conflicts must be resolved before the DFA can be built.
   * This will be evaluated during the parsing process.
   */
  readonly conflicts: (Conflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  > & {
    /**
     * Related resolvers.
     */
    resolvers: ResolvedConflict<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[];
  })[];
  /**
   * A list of resolved conflicts.
   * All conflicts must be resolved by this before the DFA can be built.
   * This will be evaluated by candidate during parsing.
   */
  readonly resolved: ResolvedConflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >[];
  callback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  rejecter?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  commit?: Condition<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  traverser?: Traverser<
    ASTData,
    ErrorType,
    Kinds,
    Token<LexerDataBindings, LexerError>
  >;

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
      GrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      | "rule"
      | "NT"
      | "callback"
      | "rejecter"
      | "rollback"
      | "commit"
      | "traverser"
      | "hydrationId"
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

    this.str = new StringCache(() => this.strWithGrammarName.value);
    this.strWithGrammarName = new StringCache(() =>
      GrammarRule.getStrWithGrammarName(this),
    );
    this.strWithoutGrammarName = new StringCache(() =>
      GrammarRule.getStrWithoutGrammarName(this),
    );
    this.hydrationId = p.hydrationId;
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
  static getStrWithGrammarName<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    gr: Pick<
      GrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "NT" | "rule"
    >,
  ) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithName)
      .join(" ")}\` }`;
  }

  /**
   * Return ``{ NT: `grammar rules without name` }``.
   */
  static getStrWithoutGrammarName<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    gr: Pick<
      GrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
      "NT" | "rule"
    >,
  ) {
    return `{ ${gr.NT}: \`${gr.rule
      .map((g) => g.grammarStrWithoutName.value)
      .join(" ")}\` }`;
  }

  toSerializable(
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
    grs: ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ): {
    // TODO: omit this return type definition
    // currently run `ts-node utils/generate-serialized-grammar-parser.ts` requires this return type definition
    NT: Kinds;
    rule: string[];
    conflicts: {
      type: ConflictType;
      anotherRule: string;
      next: string[];
      handleEnd: boolean;
      resolvers: number[];
    }[];
    resolved: {
      type: ConflictType;
      anotherRule: string;
      handleEnd: boolean;
      next: string[] | "*";
      accepter: boolean | undefined;
      hydrationId: Readonly<ResolverHydrationId> | undefined;
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
        resolvers: c.resolvers.map((r) => this.resolved.indexOf(r)),
      })),
      resolved: this.resolved.map((r) => ({
        type: r.type,
        anotherRule: grs.getKey(r.anotherRule),
        handleEnd: r.handleEnd,
        next:
          r.next == "*" ? ("*" as const) : r.next.map((g) => repo.getKey(g)),
        accepter: r.hydrationId === undefined ? r.accepter : undefined,
        hydrationId: r.hydrationId === undefined ? undefined : r.hydrationId,
      })),
      str: this.str.value,
      strWithGrammarName: this.strWithGrammarName.value,
      strWithoutGrammarName: this.strWithoutGrammarName.value,
      hydrationId: this.hydrationId,
    };
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: ReturnType<
      GrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const gr = new GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >({
      rule: data.rule.map((r) => repo.getByString(r)!),
      NT: data.NT as Kinds,
      hydrationId: data.hydrationId,
    });
    gr.str.value = data.str;
    gr.strWithGrammarName.value = data.strWithGrammarName;
    gr.strWithoutGrammarName.value = data.strWithoutGrammarName;

    // restore conflicts & resolvers after the whole grammar rule repo is filled.
    const restoreConflicts = (
      grs: ReadonlyGrammarRuleRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
    ) => {
      gr.resolved.push(
        ...data.resolved.map((r) =>
          r.hydrationId == undefined
            ? {
                type: r.type,
                anotherRule: grs.getByString(r.anotherRule)!,
                handleEnd: r.handleEnd,
                next:
                  r.next == "*"
                    ? ("*" as const)
                    : new GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>(
                        r.next.map((g) => repo.getByString(g)!),
                      ),
                accepter: r.accepter!,
                hydrationId: undefined,
              }
            : {
                type: r.type,
                anotherRule: grs.getByString(r.anotherRule)!,
                handleEnd: r.handleEnd,
                next:
                  r.next == "*"
                    ? ("*" as const)
                    : new GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>(
                        r.next.map((g) => repo.getByString(g)!),
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
          anotherRule: grs.getByString(c.anotherRule)!,
          next: new GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>(
            c.next.map((g) => repo.getByString(g)!),
          ),
          handleEnd: c.handleEnd,
          resolvers: c.resolvers.map((i) => gr.resolved[i]),
        })),
      );
    };

    return { gr, restoreConflicts };
  }
}
