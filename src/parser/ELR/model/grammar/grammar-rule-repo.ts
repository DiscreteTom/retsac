import { TempGrammarRule } from "../../builder";
import { GrammarRepo } from "./grammar-repo";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 */
export class GrammarRuleRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> {
  /**
   * {@link GrammarRule.strWithGrammarName} => grammar rule
   */
  readonly grammarRules: ReadonlyMap<
    string,
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>
  >;

  constructor(
    grs: readonly GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
  ) {
    const map = new Map();
    grs.forEach((gr) => map.set(gr.strWithGrammarName.value, gr));
    this.grammarRules = map;
  }

  getKey(gr: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>): string {
    return gr.strWithGrammarName.value;
  }

  get(gr: TempGrammarRule<ASTData, ErrorType, Kinds, LexerKinds>) {
    return this.grammarRules.get(gr.strWithGrammarName.value);
  }

  getByString(str: string) {
    return this.grammarRules.get(str);
  }

  map<R>(
    callback: (g: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>) => R
  ) {
    const res = [] as R[];
    this.grammarRules.forEach((gr) => res.push(callback(gr)));
    return res;
  }

  filter(
    callback: (g: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>) => boolean
  ) {
    const res = [] as GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toJSON(repo: GrammarRepo) {
    return this.map((gr) => gr.toJSON(repo, this));
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string
  >(
    data: ReturnType<
      GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>["toJSON"]
    >[],
    repo: GrammarRepo
  ) {
    const callbacks = [] as ((
      grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>
    ) => void)[];
    const res = new GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>(
      data.map((d) => {
        const { gr, restoreConflicts } = GrammarRule.fromJSON<
          ASTData,
          ErrorType,
          Kinds,
          LexerKinds
        >(d, repo);
        callbacks.push(restoreConflicts);
        return gr;
      })
    );
    // restore conflicts & resolvers after the whole grammar rule repo is filled.
    callbacks.forEach((c) => c(res));
    return res;
  }
}
