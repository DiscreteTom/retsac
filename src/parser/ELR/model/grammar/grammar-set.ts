import type { ASTNode } from "../../../ast";
import type { Grammar } from "./grammar";
import type { GrammarRepo } from "./grammar-repo";

/**
 * A set of different grammars, ignore the name.
 * This is used when the name of grammar is NOT needed.
 * E.g. DFA first/follow sets.
 */
export class GrammarSet<Kinds extends string, LexerKinds extends string> {
  /**
   * Grammars. {@link Grammar.strWithoutName} => grammar
   */
  private gs: Map<string, Grammar<Kinds | LexerKinds>>;

  constructor(gs: Grammar<Kinds | LexerKinds>[] = []) {
    this.gs = new Map();
    gs.forEach((g) => this.gs.set(g.strWithoutName.value, g));
  }

  get grammars() {
    return this.gs as ReadonlyMap<string, Grammar<Kinds | LexerKinds>>;
  }

  /**
   * Return `true` if successfully added(g is not in this before), else `false`.
   */
  add(g: Grammar<Kinds | LexerKinds>) {
    if (this.has(g)) return false;
    this.gs.set(g.strWithoutName.value, g);
    return true;
  }

  has(
    g:
      | Readonly<Grammar<Kinds | LexerKinds>>
      | Readonly<ASTNode<never, never, never>>,
  ) {
    return this.gs.has(g.strWithoutName.value); // Grammar & ASTNode has the same string format
  }

  map<T>(callback: (g: Grammar<Kinds | LexerKinds>) => T) {
    const res = [] as T[];
    this.gs.forEach((g) => res.push(callback(g)));
    return res;
  }

  some(callback: (g: Grammar<Kinds | LexerKinds>) => boolean) {
    for (const g of this.gs.values()) {
      if (callback(g)) return true;
    }
    return false;
  }

  filter(callback: (g: Grammar<Kinds | LexerKinds>) => boolean) {
    const res = [] as Grammar<Kinds | LexerKinds>[];
    this.gs.forEach((g) => {
      if (callback(g)) res.push(g);
    });
    return new GrammarSet(res);
  }

  /**
   * Return a list of grammars that in both `this` and `gs`.
   */
  overlap(gs: Readonly<GrammarSet<Kinds, LexerKinds>>) {
    const result = [] as Grammar<Kinds | LexerKinds>[];
    this.gs.forEach((g) => {
      if (gs.has(g)) result.push(g);
    });
    return new GrammarSet(result);
  }

  toJSON(repo: GrammarRepo<Kinds, LexerKinds>) {
    return this.map((g) => repo.getKey(g));
  }

  static fromJSON<Kinds extends string, LexerKinds extends string>(
    data: ReturnType<GrammarSet<Kinds, LexerKinds>["toJSON"]>,
    repo: GrammarRepo<Kinds, LexerKinds>,
  ) {
    return new GrammarSet(data.map((s) => repo.getByString(s)!));
  }
}
