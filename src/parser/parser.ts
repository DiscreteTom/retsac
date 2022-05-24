import { Lexer, Token } from "../lexer/lexer";
import { GrammarRule, NaiveLR } from "./naive";

/**
 * Parser can parse input string to AST.
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
