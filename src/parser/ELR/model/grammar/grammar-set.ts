import { ASTNode } from "../../../ast";
import { Grammar } from "./grammar";
import { GrammarRepo } from "./grammar-repo";

/**
 * A set of different grammars, ignore the name.
 * This is used when the name of grammar is NOT needed.
 * E.g. DFA's first/follow sets.
 */
export class GrammarSet {
  /**
   * Grammars. {@link Grammar.strWithoutName} => grammar
   */
  private gs: Map<string, Grammar>;

  constructor(gs: Grammar[] = []) {
    this.gs = new Map();
    gs.forEach((g) => this.gs.set(g.strWithoutName.value, g));
  }

  get grammars() {
    return this.gs as ReadonlyMap<string, Grammar>;
  }

  /**
   * Return `true` if successfully added(g is not in this before), else `false`.
   */
  add(g: Grammar) {
    if (this.has(g)) return false;
    this.gs.set(g.strWithoutName.value, g);
    return true;
  }

  has(g: Readonly<Grammar> | Readonly<ASTNode<any, any>>) {
    return this.gs.has(g.strWithoutName.value); // Grammar & ASTNode has the same string format
  }

  map<T>(callback: (g: Grammar) => T) {
    const res = [] as T[];
    this.gs.forEach((g) => res.push(callback(g)));
    return res;
  }

  some(callback: (g: Grammar) => boolean) {
    for (const g of this.gs.values()) {
      if (callback(g)) return true;
    }
    return false;
  }

  filter(callback: (g: Grammar) => boolean) {
    const res = [] as Grammar[];
    this.gs.forEach((g) => {
      if (callback(g)) res.push(g);
    });
    return new GrammarSet(res);
  }

  /**
   * Return a list of grammars that in both `this` and `gs`.
   */
  overlap(gs: Readonly<GrammarSet>) {
    const result = [] as Grammar[];
    this.gs.forEach((g) => {
      if (gs.has(g)) result.push(g);
    });
    return new GrammarSet(result);
  }

  toJSON(repo: GrammarRepo) {
    return this.map((g) => repo.getKey(g));
  }

  static fromJSON(data: ReturnType<GrammarSet["toJSON"]>, repo: GrammarRepo) {
    return new GrammarSet(data.map((s) => repo.getByString(s)!));
  }
}
