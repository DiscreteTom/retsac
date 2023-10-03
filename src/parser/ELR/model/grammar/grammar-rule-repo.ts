import type { TempGrammarRule } from "../../builder";
import type { GrammarRepo } from "./grammar-repo";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 */
// GrammarRuleRepo is always readonly since all inner grammar rules are created before the repo is created.
export class ReadonlyGrammarRuleRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> {
  /**
   * {@link GrammarRule.strWithGrammarName} => grammar rule
   */
  readonly grammarRules: ReadonlyMap<
    string,
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >;

  constructor(
    grs: readonly GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[],
  ) {
    const map = new Map();
    grs.forEach((gr) => map.set(gr.strWithGrammarName.value, gr));
    this.grammarRules = map;
  }

  getKey(
    gr: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  ): string {
    return gr.strWithGrammarName.value;
  }

  get(gr: TempGrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>) {
    return this.grammarRules.get(gr.strWithGrammarName.value);
  }

  getByString(str: string) {
    return this.grammarRules.get(str);
  }

  map<R>(
    callback: (
      g: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    ) => R,
  ) {
    const res = [] as R[];
    this.grammarRules.forEach((gr) => res.push(callback(gr)));
    return res;
  }

  filter(
    callback: (
      g: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    ) => boolean,
  ) {
    const res = [] as GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toSerializable(
    repo: GrammarRepo<Kinds, LexerKinds>,
  ): ReturnType<
    GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >["toSerializable"]
  >[] {
    return this.map((gr) => gr.toSerializable(repo, this));
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    data: ReturnType<
      GrammarRule<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError
      >["toSerializable"]
    >[],
    repo: GrammarRepo<Kinds, LexerKinds>,
  ) {
    const callbacks = [] as ((
      grs: ReadonlyGrammarRuleRepo<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError
      >,
    ) => void)[];
    const res = new ReadonlyGrammarRuleRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >(
      data.map((d) => {
        const { gr, restoreConflicts } = GrammarRule.fromJSON<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds,
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
