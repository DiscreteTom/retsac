import { Grammar, GrammarType } from "./grammar";

/**
 * A set of different grammars, include the name.
 * This is used to manage the creation of grammars, to prevent creating the same grammar twice.
 */
export class GrammarRepo<AllKinds extends string> {
  /**
   * Grammars. {@link Grammar.getGrammarStrWithName} => grammar
   */
  private gs: Map<string, Grammar<AllKinds>>;

  constructor() {
    this.gs = new Map();
  }

  getByString(str: string) {
    return this.gs.get(str);
  }

  getKey(data: Pick<Grammar<AllKinds>, "kind" | "name" | "text">): string {
    return data instanceof Grammar
      ? data.grammarStrWithName
      : Grammar.getGrammarStrWithName(data);
  }

  get(data: Pick<Grammar<AllKinds>, "kind" | "name" | "text">) {
    return this.getByString(this.getKey(data));
  }

  /**
   * Get or create a T grammar.
   */
  T(kind: AllKinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name });
    const res = this.getByString(str);
    if (res !== undefined) return res;

    const g = new Grammar<AllKinds>({
      type: GrammarType.T,
      kind,
      name,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.T(kind); // ensure the unnamed grammar is created

    return g;
  }

  /**
   * Get or create a NT grammar.
   */
  NT(kind: AllKinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name });
    const res = this.getByString(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.NT,
      kind,
      name,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.NT(kind); // ensure the unnamed grammar is created

    return g;
  }

  /**
   * Get or create a T grammar with text.
   */
  Literal(text: string, kind: AllKinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name, text });
    const res = this.getByString(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.T,
      kind,
      name,
      text,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.Literal(text, kind); // ensure the unnamed grammar is created

    return g;
  }

  toJSON() {
    const result = [] as ReturnType<Grammar<AllKinds>["toJSON"]>[];
    this.gs.forEach((g) => result.push(g.toJSON()));
    return result;
  }

  static fromJSON<AllKinds extends string>(
    data: ReturnType<GrammarRepo<AllKinds>["toJSON"]>,
  ) {
    const repo = new GrammarRepo<AllKinds>();
    data.forEach((d) => repo.gs.set(d.grammarStrWithName, Grammar.fromJSON(d)));
    return repo;
  }
}
