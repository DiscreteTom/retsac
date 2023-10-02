import { Grammar, GrammarType } from "./grammar";

/**
 * A set of different grammars, include the name.
 * This is used to manage the creation of grammars, to prevent creating the same grammar twice.
 */
export class GrammarRepo<Kinds extends string, LexerKinds extends string> {
  /**
   * Grammars. {@link Grammar.getGrammarStrWithName} => grammar
   */
  private gs: Map<string, Grammar<Kinds | LexerKinds>>;

  constructor() {
    this.gs = new Map();
  }

  getByString(str: string) {
    return this.gs.get(str);
  }

  getKey(
    data: Pick<Grammar<Kinds | LexerKinds>, "kind" | "name" | "text">,
  ): string {
    return data instanceof Grammar
      ? data.grammarStrWithName
      : Grammar.getGrammarStrWithName(data);
  }

  get(data: Pick<Grammar<Kinds | LexerKinds>, "kind" | "name" | "text">) {
    return this.getByString(this.getKey(data));
  }

  /**
   * Get or create a T grammar.
   */
  T(kind: LexerKinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name });
    const res = this.getByString(str);
    if (res !== undefined) return res as Grammar<LexerKinds>;

    const g = new Grammar<Kinds | LexerKinds>({
      type: GrammarType.T,
      kind,
      name,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.T(kind); // ensure the unnamed grammar is created

    return g as Grammar<LexerKinds>;
  }

  /**
   * Get or create a NT grammar.
   */
  NT(kind: Kinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name });
    const res = this.getByString(str);
    if (res !== undefined) return res as Grammar<Kinds>;

    const g = new Grammar<Kinds | LexerKinds>({
      type: GrammarType.NT,
      kind,
      name,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.NT(kind); // ensure the unnamed grammar is created

    return g as Grammar<Kinds>;
  }

  /**
   * Get or create a T grammar with text.
   */
  Literal(text: string, kind: LexerKinds, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name, text });
    const res = this.getByString(str);
    if (res !== undefined) return res as Grammar<LexerKinds>;

    const g = new Grammar<Kinds | LexerKinds>({
      type: GrammarType.T,
      kind,
      name,
      text,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);

    if (name != undefined) this.Literal(text, kind); // ensure the unnamed grammar is created

    return g as Grammar<LexerKinds>;
  }

  toJSON() {
    const result = [] as ReturnType<Grammar<Kinds | LexerKinds>["toJSON"]>[];
    this.gs.forEach((g) => result.push(g.toJSON()));
    return result;
  }

  static fromJSON<Kinds extends string, LexerKinds extends string>(
    data: ReturnType<GrammarRepo<Kinds, LexerKinds>["toJSON"]>,
  ) {
    const repo = new GrammarRepo<Kinds, LexerKinds>();
    data.forEach((d) => repo.gs.set(d.grammarStrWithName, Grammar.fromJSON(d)));
    return repo;
  }
}
