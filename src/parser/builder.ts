import { Lexer, Token } from "../lexer/lexer";
import { ASTNode } from "./ast";
import { Parser } from "./parser";

export type TokenBuffer = (ASTNode | Token)[]; // token tree buffer
export type Reducer = (
  b: TokenBuffer
) => { reduced: false } | { reduced: true; buffer: TokenBuffer };

export class Builder {
  private reducers: Reducer[];
  lexer: Lexer;

  constructor(lexer?: Lexer) {
    this.reducers = [];
    this.lexer = lexer;
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  simple(defs: { [NT: string]: string }) {
    for (const NT in defs) {
      // get grammar parts
      const grammar = defs[NT].split("|")
        .map((s) => s.trim())
        .filter((s) => s.length);

      // define grammar lexer
      let grammarLexer = Lexer.ignore(/^\s/).define({ grammar: /^\w+/ });

      // construct reducer
      grammar.map((grammarStr) => {
        // grammar must be correctly tokenized
        let grammarParts = grammarLexer
          .lexAll(grammarStr)
          .map((t) => t.content);
        if (!grammarLexer.isDone())
          throw new Error(`Can't tokenize ${grammarLexer.getRest()}`);

        this.reducers.push((buffer) => {
          // traverse every possibility
          for (
            let start = 0;
            start < buffer.length - grammarParts.length + 1;
            start++
          ) {
            if (
              buffer
                .slice(start, start + grammarParts.length)
                .map((t) => t.type)
                .every((t, i) => t == grammarParts[i])
            ) {
              // can reduce, construct new AST node
              let node = new ASTNode({
                type: NT,
                children: buffer
                  .slice(start, start + grammarParts.length)
                  .map((t) =>
                    t instanceof ASTNode
                      ? t
                      : new ASTNode({
                          type: t.type,
                          text: t.content,
                          children: [],
                          parent: null,
                        })
                  ),
                parent: null,
              });
              node.children.map((c) => (c.parent = node));

              // return new buffer
              return {
                reduced: true,
                buffer: buffer
                  .slice(0, start)
                  .concat(node)
                  .concat(buffer.slice(start + grammarParts.length)),
              };
            }
          }
          return { reduced: false };
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

    return new Parser(this.lexer, this.reducers);
  }
}
