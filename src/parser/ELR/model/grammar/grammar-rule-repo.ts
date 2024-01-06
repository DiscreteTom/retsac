import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { GrammarRepo } from "./grammar-repo";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 *
 * The key of the map is the {@link GrammarRule.id}.
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
> {
  /**
   * {@link GrammarRule.id} => grammar rule
   */
  readonly grammarRules: ReadonlyMap<
    string,
    GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
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
      LexerErrorType
    >[],
  ) {
    const map = new Map();
    grs.forEach((gr) => map.set(gr.id, gr));
    this.grammarRules = map; // make the map readonly
  }

  /**
   * Get the grammar rule by the {@link GrammarRule.id}.
   */
  get(id: string) {
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
        LexerErrorType
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
        LexerErrorType
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
      LexerErrorType
    >[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toJSON() {
    return this.map((gr) => gr.toJSON());
  }

  static fromJSON<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    data: ReturnType<
      ReadonlyGrammarRuleRepo<
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
    const callbacks = [] as ((
      grs: ReadonlyGrammarRuleRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
    ) => void)[];
    const res = new ReadonlyGrammarRuleRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >(
      data.map((d) => {
        const { gr, restoreConflicts } = GrammarRule.fromJSON<
          NTs,
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType
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
