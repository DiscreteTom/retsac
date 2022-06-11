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

  /** Parse input string to token then to ASTNode and push to buffer. */
  feed(s: string) {
    this.buffer.push(
      ...this.lexer
        .lexAll(s)
        .map((t) => new ASTNode({ type: t.type, text: t.content }))
    );

    return this;
  }

  /** Return buffer if any parser accept. */
  parse(s?: string) {
    if (s) this.feed(s);

    outer: while (true) {
      // traverse all parsers
      for (const parse of this.parsers) {
        let res = parse(this.buffer);
        if (res.accept) {
          // update state
          this.errors.push(...res.errors);
          this.buffer = res.buffer;

          return { buffer: this.buffer, accept: true };
        }
      }
      // no parser can accept
      break;
    }

    return { buffer: this.buffer, accept: false };
  }

  /** Return buffer if all parser can't accept more. */
  parseAll(s?: string) {
    if (s) this.feed(s);

    let accept = false;

    outer: while (true) {
      // traverse all parsers
      for (const parse of this.parsers) {
        let res = parse(this.buffer);
        if (res.accept) {
          // update state
          this.errors.push(...res.errors);
          this.buffer = res.buffer;
          accept = true;

          continue outer; // re-traverse all parsers
        }
      }
      // no parser can accept
      break;
    }

    return { buffer: this.buffer, accept };
  }
}
