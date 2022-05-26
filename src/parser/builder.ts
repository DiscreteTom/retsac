import { Action } from "../lexer/action";
import { Lexer, Token } from "../lexer/lexer";
import { from_to } from "../lexer/utils";
import { Parser } from "./parser";

export type GrammarRule = {
  rule: Token[]; // a list of Ts or NTs or literal strings, `token.type` should be `grammar` or `literal`
  NT: string; // the reduce target
  tag: string; // to specify priority or other attributes
};

// Builder for parser.
export class Builder {
  lexer: Lexer;
  private defs: GrammarRule[]; // sorted by order
  private basicLexer: Lexer;

  constructor(lexer?: Lexer) {
    this.lexer = lexer;
    this.defs = [];
    this.basicLexer = Lexer.ignore(/^\s/)
      .define({
        grammar: /^\w+/,
        tag: Action.from(/^@\w+/).transform((s) => s.slice(1)),
      })
      .define({
        literal: from_to('"', '"', false).transform((s) => s.slice(1, -1)),
      })
      .define({
        literal: from_to("'", "'", false).transform((s) => s.slice(1, -1)),
      });
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  define(defs: { [name: string]: string }) {
    for (const NT in defs) {
      defs[NT].split("|") // get all rule strings from one grammar string
        .map((s) => s.trim())
        .filter((s) => s.length)
        .map((ruleStr) => {
          let tokens = this.basicLexer.reset().lexAll(ruleStr);

          if (!this.basicLexer.isDone())
            throw new Error(
              `Can't tokenize: "${this.basicLexer.getRest()}" in grammar rule: "${ruleStr}"`
            );

          let tags = tokens
            .filter((t) => t.type == "tag")
            .map((t) => t.content);
          let nonTags = tokens.filter((t) => t.type != "tag"); // 'literal' or 'grammar'

          if (tags.length > 1)
            throw new Error(`Duplicated tags for rule '${NT}=>${ruleStr}'`);

          if (nonTags.length == 0)
            throw new Error(
              `No grammar or literal in rule '${NT}=>${ruleStr}'`
            );

          if (
            !nonTags
              .filter((t) => t.type == "literal")
              .every((t) => t.content.length > 0)
          )
            throw new Error(
              `Literal value can't be empty in rule '${NT}=>${ruleStr}'`
            );

          this.defs.push({
            NT,
            rule: nonTags,
            tag: tags.length > 0 ? tags[0] : "",
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
