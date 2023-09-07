import { TempGrammarRule } from "../../builder";
import { GrammarRepo } from "./grammar-repo";
import { GrammarRule } from "./grammar-rule";

/**
 * A set of different grammar rules, grammar's name will be included.
 * This is used to manage the creation of grammar rules, to prevent creating the same grammar rule twice.
 */
export class GrammarRuleRepo<ASTData, Kinds extends string> {
  /**
   * {@link GrammarRule.strWithGrammarName} => grammar rule
   */
  readonly grammarRules: ReadonlyMap<string, GrammarRule<ASTData, Kinds>>;

  constructor(grs: readonly GrammarRule<ASTData, Kinds>[]) {
    const map = new Map();
    grs.forEach((gr) => map.set(gr.strWithGrammarName.value, gr));
    this.grammarRules = map;
  }

  getKey(gr: GrammarRule<any, any>): string {
    return gr.strWithGrammarName.value;
  }

  get(gr: TempGrammarRule<any, any>) {
    return this.grammarRules.get(gr.toStringWithGrammarName());
  }

  map<R>(callback: (g: GrammarRule<ASTData, Kinds>) => R) {
    const res = [] as R[];
    this.grammarRules.forEach((gr) => res.push(callback(gr)));
    return res;
  }

  filter(callback: (g: GrammarRule<ASTData, Kinds>) => boolean) {
    const res = [] as GrammarRule<ASTData, Kinds>[];
    this.grammarRules.forEach((gr) => {
      if (callback(gr)) res.push(gr);
    });
    return res;
  }

  toSerializable(repo: GrammarRepo) {
    return this.map((gr) => gr.toSerializable(repo, this));
  }
}
