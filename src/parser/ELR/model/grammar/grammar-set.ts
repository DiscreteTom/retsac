import type { Grammar } from "./grammar";
import type { GrammarRepo } from "./grammar-repo";

/**
 * A set of different grammars, ignore the name.
 * This is used when the name of grammar is NOT needed.
 * E.g. DFA first/follow sets.
 *
 * The key of this map is {@link Grammar.idWithoutName}.
 */
export class GrammarSet<NTs extends string, LexerKinds extends string> {
  /**
   * Grammars.
   *
   * {@link Grammar.idWithoutName} => grammar
   */
  private gs: Map<string, Grammar<NTs | LexerKinds>>;

  constructor(gs: Grammar<NTs | LexerKinds>[] = []) {
    this.gs = new Map();
    gs.forEach((g) => this.gs.set(g.idWithoutName, g));
  }

  get grammars() {
    // make this readonly
    return this.gs as ReadonlyMap<string, Grammar<NTs | LexerKinds>>;
  }

  /**
   * Return `true` if successfully added(`g` is not in this before), else `false`.
   */
  add(g: Grammar<NTs | LexerKinds>) {
    if (this.has(g)) return false;
    this.gs.set(g.idWithoutName, g);
    return true;
  }

  has(g: Grammar<NTs | LexerKinds>) {
    return this.gs.has(g.idWithoutName);
  }

  map<T>(callback: (g: Readonly<Grammar<NTs | LexerKinds>>) => T) {
    const res = [] as T[];
    this.gs.forEach((g) => res.push(callback(g)));
    return res;
  }

  some(callback: (g: Readonly<Grammar<NTs | LexerKinds>>) => boolean) {
    for (const g of this.gs.values()) {
      if (callback(g)) return true;
    }
    return false;
  }

  filter(callback: (g: Readonly<Grammar<NTs | LexerKinds>>) => boolean) {
    const res = [] as Grammar<NTs | LexerKinds>[];
    this.gs.forEach((g) => {
      if (callback(g)) res.push(g);
    });
    return new GrammarSet(res);
  }

  /**
   * Return a list of grammars that in both `this` and `gs`.
   */
  overlap(gs: Readonly<GrammarSet<NTs, LexerKinds>>) {
    const result = [] as Grammar<NTs | LexerKinds>[];
    this.gs.forEach((g) => {
      if (gs.has(g)) result.push(g);
    });
    return new GrammarSet(result);
  }

  toJSON() {
    return this.map((g) => g.idWithName);
  }

  static fromJSON<Kinds extends string, LexerKinds extends string>(
    data: ReturnType<GrammarSet<Kinds, LexerKinds>["toJSON"]>,
    repo: GrammarRepo<Kinds, LexerKinds>,
  ) {
    return new GrammarSet(data.map((s) => repo.getById(s)!));
  }
}
