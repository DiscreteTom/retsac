import { Grammar, GrammarType } from "./grammar";

/**
 * A set of different grammars, include the name.
 * This is used to manage the creation of grammars, to prevent creating the same grammar twice.
 */
export class GrammarRepo {
  /**
   * Grammars. {@link Grammar.getGrammarStrWithName} => grammar
   */
  private gs: Map<string, Grammar>;

  constructor() {
    this.gs = new Map();
  }

  private getByString(str: string) {
    return this.gs.get(str);
  }

  getKey(data: Pick<Grammar, "kind" | "name" | "text">) {
    if (data instanceof Grammar) return data.grammarStrWithName;
    return Grammar.getGrammarStrWithName(data);
  }

  get(data: Pick<Grammar, "kind" | "name" | "text">) {
    return this.getByString(this.getKey(data));
  }

  /**
   * Get or create a T grammar.
   */
  T(kind: string, name?: string) {
    name = name ?? kind;
    const str = Grammar.getGrammarStrWithName({ kind, name });
    const res = this.getByString(str);
    if (res !== undefined) return res;

    const g = new Grammar({
      type: GrammarType.T,
      kind,
      name,
      grammarStrWithName: str,
    });
    this.gs.set(str, g);
    return g;
  }

  /**
   * Get or create a NT grammar.
   */
  NT(kind: string, name?: string) {
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
    return g;
  }

  /**
   * Get or create a T grammar with text.
   */
  Literal(text: string, kind: string, name?: string) {
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
    return g;
  }

  toJSON() {
    const result = [] as ReturnType<Grammar["toJSON"]>[];
    this.gs.forEach((g) => result.push(g.toJSON()));
    return result;
  }
}
