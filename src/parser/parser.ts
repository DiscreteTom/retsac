import { Lexer, Token } from "../lexer/lexer";
import { ASTNode } from "./ast";
import { Reducer, TokenBuffer } from "./builder";

/**
 * Parser can parse input string to AST.
 */
export class Parser {
  private lexer: Lexer;
  private reducers: Reducer[];
  private buffer: TokenBuffer;

  constructor(lexer: Lexer, reducers: Reducer[]) {
    this.lexer = lexer;
    this.reducers = reducers;
    this.buffer = [];
  }

  reset() {
    this.lexer.reset();
    this.buffer = [];
  }

  /**
   * Try to parse the input string to AST.
   * Return buffer.
   */
  parse(s: string) {
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
