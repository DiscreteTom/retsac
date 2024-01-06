import { Grammar, GrammarType } from "./grammar";

/**
 * A set of different grammars (the name is counted).
 * This is used to manage the creation of grammars, to prevent creating the same grammar twice.
 *
 * The key of the map is the {@link Grammar.grammarString}.
 */
export class GrammarRepo<NTs extends string, LexerKinds extends string> {
  /**
   * Grammars.
   *
   * {@link Grammar.grammarString} => grammar
   */
  private gs: Map<string, Grammar<NTs | LexerKinds>>;

  constructor() {
    this.gs = new Map();
  }

  /**
   * Get the grammar by the {@link Grammar.grammarString}.
   */
  get(key: string) {
    return this.gs.get(key);
  }

  /**
   * Get the grammar by the id with name for non-grammar objects.
   */
  match(data: Pick<Grammar<NTs | LexerKinds>, "kind" | "name" | "text">) {
    return this.get(Grammar.getGrammarString(data));
  }

  /**
   * Get or create a T grammar.
   */
  T(kind: LexerKinds, name: string) {
    const key = Grammar.getGrammarString({
      kind,
      name,
      text: undefined,
    });
    const res = this.get(key);
    if (res !== undefined) return res as Grammar<LexerKinds>;

    const g = new Grammar<NTs | LexerKinds>({
      type: GrammarType.T,
      kind,
      name,
      text: undefined,
      grammarString: key,
      grammarStringNoName: Grammar.getGrammarStringNoName({
        kind,
        text: undefined,
      }),
    });
    this.gs.set(key, g);

    if (name !== kind)
      // this grammar is renamed, ensure the un-renamed grammar is created
      this.T(kind, kind);

    return g as Grammar<LexerKinds>;
  }

  /**
   * Get or create an NT grammar.
   */
  NT(kind: NTs, name: string) {
    const key = Grammar.getGrammarString({
      kind,
      name,
      text: undefined,
    });
    const res = this.get(key);
    if (res !== undefined) return res as Grammar<NTs>;

    const g = new Grammar<NTs | LexerKinds>({
      type: GrammarType.NT,
      kind,
      name,
      text: undefined,
      grammarString: key,
      grammarStringNoName: Grammar.getGrammarStringNoName({
        kind,
        text: undefined,
      }),
    });
    this.gs.set(key, g);

    if (name !== kind)
      // this grammar is renamed, ensure the un-renamed grammar is created
      this.NT(kind, kind);

    return g as Grammar<NTs>;
  }

  /**
   * Get or create a T grammar with text.
   */
  Literal(text: string, kind: LexerKinds, name: string) {
    const key = Grammar.getGrammarString({ kind, name, text });
    const res = this.get(key);
    if (res !== undefined) return res as Grammar<LexerKinds>;

    const g = new Grammar<NTs | LexerKinds>({
      type: GrammarType.T,
      kind,
      name,
      text,
      grammarString: key,
      grammarStringNoName: Grammar.getGrammarStringNoName({
        kind,
        text,
      }),
    });
    this.gs.set(key, g);

    if (name !== kind)
      // this grammar is renamed, ensure the un-renamed grammar is created
      this.Literal(text, kind, kind);

    return g as Grammar<LexerKinds>;
  }

  map<T>(callback: (g: Readonly<Grammar<NTs | LexerKinds>>) => T) {
    const res = [] as T[];
    this.gs.forEach((g) => res.push(callback(g)));
    return res;
  }

  toJSON() {
    return this.map((g) => g.toJSON());
  }

  static fromJSON<NTs extends string, LexerKinds extends string>(
    data: ReturnType<GrammarRepo<NTs, LexerKinds>["toJSON"]>,
  ) {
    const repo = new GrammarRepo<NTs, LexerKinds>();
    data.forEach((d) => repo.gs.set(d.grammarString, Grammar.fromJSON(d)));
    return repo;
  }
}
