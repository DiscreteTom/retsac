import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { TempGrammarRule } from "../../builder";
import type { GrammarRepo } from "./grammar-repo";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 */
// GrammarRuleRepo is always readonly since all inner grammar rules are created before the repo is created.
export class ReadonlyGrammarRuleRepo<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  /**
   * {@link GrammarRule.strWithGrammarName} => grammar rule
   */
  readonly grammarRules: ReadonlyMap<
    string,
    GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
  >;

  constructor(
    grs: readonly GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[],
  ) {
    const map = new Map();
    grs.forEach((gr) => map.set(gr.strWithGrammarName.value, gr));
    this.grammarRules = map;
  }

  getKey(
    gr: GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ): string {
    return gr.strWithGrammarName.value;
  }

  get(
    gr: TempGrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >,
  ) {
    return this.grammarRules.get(gr.strWithGrammarName.value);
  }

  getByString(str: string) {
    return this.grammarRules.get(str);
  }

  map<R>(
    callback: (
      g: GrammarRule<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
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
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
    ) => boolean,
  ) {
    const res = [] as GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toSerializable(
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ): ReturnType<
    GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >["toSerializable"]
  >[] {
    return this.map((gr) => gr.toSerializable(repo, this));
  }

  static fromJSON<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerError,
  >(
    data: ReturnType<
      GrammarRule<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["toSerializable"]
    >[],
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const callbacks = [] as ((
      grs: ReadonlyGrammarRuleRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >,
    ) => void)[];
    const res = new ReadonlyGrammarRuleRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >(
      data.map((d) => {
        const { gr, restoreConflicts } = GrammarRule.fromJSON<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerError
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
