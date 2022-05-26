import { Lexer, Token } from "../lexer/lexer";
import { GrammarRule, NaiveLR } from "./naive";

/**
 * Parser can parse input string to AST.
 *
 * Grammars:
 * - `A | B` means `A` or `B`
 * - `A B` means `A` then `B`
 * - `@tag` means create a tag for the grammar rule
 *
 * E.g.: `A B @nice | B` means `A B` or `B`, and `A B` has a tag `nice`.
 */
export class Parser {
  private lexer: Lexer;
  private lr: NaiveLR;

  constructor(lexer: Lexer, lr: NaiveLR) {
    this.lexer = lexer;
    this.lr = lr;
  }

  reset() {
    this.lexer.reset();
    this.lr.reset();
  }

  parse(s: string) {
    return this.lr.feed(this.lexer.lexAll(s)).getBuffer();
  }

  getBuffer() {
    return this.lr.getBuffer();
  }
}
