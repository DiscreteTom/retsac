import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { GrammarRepo } from "./grammar-repo";
import type { GrammarRuleID, SerializableGrammarRule } from "./grammar-rule";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 *
 * The key of the map is the {@link GrammarRuleID}.
 *
 * This is always readonly since all grammar rules are created before the repo is created.
 */
export class ReadonlyGrammarRuleRepo<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  /**
   * {@link GrammarRuleID} => {@link GrammarRule}
   */
  readonly grammarRules: ReadonlyMap<
    GrammarRuleID,
    GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;

  constructor(
    grs: readonly GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >[],
  ) {
    const map = new Map<
      GrammarRuleID,
      GrammarRule<
        NTs,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >();
    grs.forEach((gr) => map.set(gr.id, gr));
    this.grammarRules = map; // make the map readonly
  }

  /**
   * Get the grammar rule by the {@link GrammarRule.id}.
   */
  get(id: GrammarRuleID) {
    return this.grammarRules.get(id);
  }

  map<R>(
    callback: (
      g: GrammarRule<
        NTs,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => R,
  ) {
    const res = [] as R[];
    this.grammarRules.forEach((gr) => res.push(callback(gr)));
    return res;
  }

  filter(
    callback: (
      g: GrammarRule<
        NTs,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => boolean,
  ) {
    const res = [] as GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toJSON(): SerializableGrammarRule<NTs>[] {
    return this.map((gr) => gr.toJSON());
  }

  static fromJSON<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
    Global,
  >(
    data: SerializableGrammarRule<NTs>[],
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  ) {
    const callbacks = [] as ((
      grs: ReadonlyGrammarRuleRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => void)[];
    const res = new ReadonlyGrammarRuleRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >(
      data.map((d) => {
        const { gr, restoreConflicts } = GrammarRule.fromJSON<
          NTs,
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >(d, repo);
        callbacks.push(restoreConflicts);
        return gr;
      }),
    );
    // restore conflicts & resolvers after the whole grammar rule repo is filled.
    callbacks.forEach((c) => c(res));
    return res;
  }
}
