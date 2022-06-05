import { Lexer } from "../lexer/lexer";
import { ASTNode } from "./ast";
import { Parser } from "./model";

/**
 * ParserManager will use a lexer to retrieve tokens,
 * call parsers orderly to reduce buffer,
 * and gather errors.
 */
export class ParserManager {
  private parsers: Parser[];
  private lexer: Lexer;
  private buffer: ASTNode[];
  private errors: ASTNode[];

  constructor(lexer?: Lexer) {
    this.parsers = [];
    this.buffer = [];
    this.errors = [];
    this.lexer = lexer;
  }

  reset() {
    this.buffer = [];
    this.errors = [];
  }

  getBuffer() {
    return this.buffer;
  }

  getErrors() {
    return this.errors;
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  add(r: Parser) {
    this.parsers.push(r);
    return this;
  }

  parse(s: string) {
    this.buffer.push(
      ...this.lexer
        .lexAll(s)
        .map((t) => new ASTNode({ type: t.type, text: t.content }))
    );

    outer: while (true) {
      // traverse all parsers
      for (const parse of this.parsers) {
        let res = parse(this.buffer);
        if (res.accept) {
          // update state
          this.errors.push(...res.errors);
          this.buffer = res.buffer;

          continue outer; // re-traverse all parsers
        }
      }
      // no parser can accept
      break;
    }

    return this.buffer;
  }
}
