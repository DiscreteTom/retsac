import { Action } from "../lexer/action";
import { Lexer, Token } from "../lexer/lexer";
import { ASTNode } from "./ast";
import { GrammarRule } from "./builder";

/**
 * Parser can parse input string to AST.
 *
 * Grammars:
 * - `A | B` means `A` or `B`
 * - `A B` means `A` then `B`
 * - `@tag` means create a tag for the grammar rule
 * - `'xxx'` or `"xxx"` means literal string `xxx`
 *
 * E.g.: `A B @nice | 'xxx' B` means `A B` or `'xxx' B`, and `A B` has a tag `nice`.
 */
export class Parser {
  private lexer: Lexer;
  private defs: GrammarRule[];
  private buffer: (ASTNode | Token)[];

  constructor(lexer: Lexer, defs: GrammarRule[]) {
    this.lexer = lexer;
    this.defs = defs;
    this.buffer = [];
  }

  reset() {
    this.lexer.reset();
    this.buffer = [];
  }

  parse(s: string) {
    this.buffer.push(...this.lexer.lexAll(s));

    while (true) {
      let reduced = false;
      // traverse all grammar rule in order
      outer: for (const g of this.defs) {
        if (this.buffer.length < g.rule.length)
          // buffer not long enough
          // can't reduce, try next rule
          continue;

        // check a chunk of buffer
        // try left-most reduce
        for (let i = 0; i <= this.buffer.length - g.rule.length; ++i) {
          let chunk = this.buffer.slice(i, i + g.rule.length);

          if (
            chunk.every((t, i) =>
              g.rule[i].type == "grammar"
                ? g.rule[i].content == t.type
                : !(t instanceof ASTNode) && g.rule[i].content == t.content
            )
          ) {
            // can reduce

            // construct new node
            let node = new ASTNode({
              type: g.NT,
              children: chunk.map((t) =>
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

            // update buffer
            this.buffer = this.buffer
              .slice(0, i)
              .concat(node)
              .concat(this.buffer.slice(i + g.rule.length));

            // traverse all grammar rules again
            reduced = true;
            break outer;
          }
          // else, can't reduce, try next chunk
        }

        // no reduce, try next rule
      }

      if (!reduced)
        // all rules can't reduce more
        break;
    }

    return this.getBuffer();
  }

  getBuffer() {
    return this.buffer;
  }
}
