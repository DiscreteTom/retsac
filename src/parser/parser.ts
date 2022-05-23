import { Lexer, Token } from "../lexer/lexer";
import { Grammar, NaiveLR } from "./naive_LR";

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
    this.lexer.feed(s);
    this.lexer.apply((t) => {
      this.lr.feedOne(t);
    });
    return this.lr.getBuffer();
  }

  getBuffer() {
    return this.lr.getBuffer();
  }
}
