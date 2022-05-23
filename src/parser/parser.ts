import { Lexer, Token } from "../lexer/lexer";
import { ASTNode } from "./ast";

export type TokenBuffer = (ASTNode | Token)[]; // token tree buffer
export type Reducer = (
  b: TokenBuffer
) => { reduced: false } | { reduced: true; buffer: TokenBuffer };

/**
 * Parser can parse input string to AST.
 */
export class Parser {
  private lexer: Lexer;
  private reducers: Reducer[];
  private buffer: TokenBuffer;

  constructor(lexer?: Lexer) {
    this.lexer = lexer;
    this.reducers = [];
    this.buffer = [];
  }

  reset() {
    this.lexer.reset();
    this.buffer = [];
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
   * Try to parse the input string to AST.
   * Return buffer.
   */
  parse(s: string) {
    if (!this.lexer) throw new Error("Missing lexer");

    this.buffer.push(...this.lexer.feed(s).lexAll());

    while (true) {
      // traverse all reducers
      let reduced = false;
      for (const r of this.reducers) {
        let res = r(this.buffer);
        if (res.reduced) {
          reduced = true;
          this.buffer = res.buffer; // update buffer
          break; // traverse again
        }
      }

      if (!reduced) {
        // no more reduce, stop loop
        break;
      } // else, traverse again
    }

    return this.buffer;
  }

  getBuffer() {
    return this.buffer;
  }
}
