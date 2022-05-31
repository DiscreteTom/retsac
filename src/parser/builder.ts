import { Lexer, Token } from "../lexer/lexer";
import { exact, from_to } from "../lexer/utils";
import { Parser } from "./parser";
import { Reducer } from "./reducer";

export type GrammarRule = {
  rule: Token[]; // a list of Ts or NTs or literal strings, `token.type` should be `grammar` or `literal`
  NT: string; // the reduce target
  reducer: Reducer;
};

// Builder for parser.
export class Builder {
  lexer: Lexer;
  private defs: GrammarRule[]; // sorted by order
  private basicLexer: Lexer;

  constructor(lexer?: Lexer) {
    this.lexer = lexer;
    this.defs = [];
    this.basicLexer = new Lexer()
      .ignore(/^\s/)
      .define({
        grammar: /^\w+/,
        or: exact("|"),
      })
      .overload({
        literal: [
          from_to('"', '"', false).transform((s) => s.slice(1, -1)),
          from_to("'", "'", false).transform((s) => s.slice(1, -1)),
        ],
      });
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  define(defs: { [name: string]: string }, reducer?: Reducer) {
    reducer ??= () => {}; // default reducer

    for (const NT in defs) {
      // parse rules
      let rules: Token[][] = [[]];
      this.basicLexer
        .reset()
        .lexAll(defs[NT])
        .map((t) => {
          if (t.type == "or") rules.push([]);
          else rules.at(-1).push(t);
        });

      if (this.basicLexer.hasRest())
        throw new Error(
          `Can't tokenize: "${this.basicLexer.getRest()}" in grammar rule: "${
            defs[NT]
          }"`
        );

      rules.map((tokens) => {
        let ruleStr = tokens.map((t) =>
          t.type == "grammar" ? t.content : '"' + t.content + '"'
        );

        if (tokens.length == 0)
          throw new Error(`No grammar or literal in rule '${NT}=>${ruleStr}'`);

        if (
          !tokens
            .filter((t) => t.type == "literal")
            .every((t) => t.content.length > 0)
        )
          throw new Error(
            `Literal value can't be empty in rule '${NT}=>${ruleStr}'`
          );

        this.defs.push({
          NT,
          rule: tokens,
          reducer,
        });
      });
    }
    return this;
  }

  /**
   * Build a parser.
   */
  compile() {
    if (!this.lexer) throw new Error("Missing lexer");
    this.checkGrammar();

    return new Parser(this.lexer, this.defs);
  }

  /**
   * Check errors in grammar rules.
   */
  private checkGrammar() {
    let tNameSet = this.lexer.getTokenTypes(); // terminator definitions
    let ntNameSet: Set<string> = new Set(); // non-terminator definitions
    let grammarSet: Set<string> = new Set();

    // collect NT names and grammars
    this.defs.map((d) => {
      ntNameSet.add(d.NT);
      d.rule
        .filter((t) => t.type == "grammar")
        .map((grammar) => grammarSet.add(grammar.content));
    });

    // all grammars should have its definition
    grammarSet.forEach((grammar) => {
      if (!tNameSet.has(grammar) && !ntNameSet.has(grammar))
        throw new Error(`Undefined grammar: ${grammar}`);
    });

    // NTs can't have same name with Ts
    ntNameSet.forEach((name) => {
      if (tNameSet.has(name)) throw new Error(`Duplicated definition: ${name}`);
    });
  }
}
