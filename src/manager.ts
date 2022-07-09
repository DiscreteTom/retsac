import { Lexer } from "./lexer/lexer";
import { ASTNode } from "./parser/ast";
import { Parser } from "./parser/model";

/**
 * Manager will use a lexer to retrieve tokens,
 * and a parser to reduce buffer and gather errors.
 */
export class Manager {
  private lexer: Lexer;
  private parser: Parser;
  private buffer: ASTNode[];
  /** Error nodes. */
  private errors: ASTNode[];

  constructor(p: { lexer: Lexer; parser: Parser }) {
    this.lexer = p.lexer;
    this.parser = p.parser;
    this.reset();
  }

  reset() {
    this.buffer = [];
    this.errors = [];
    this.lexer.reset();
    this.parser.reset();
  }

  getBuffer() {
    return this.buffer;
  }

  getErrors() {
    return this.errors;
  }

  /** Parse input string to token then to ASTNode and push to buffer. */
  feed(s: string) {
    this.buffer.push(...this.lexer.lexAll(s).map((t) => ASTNode.from(t)));
    return this;
  }

  /** Try to reduce AST nodes once. */
  parse(s?: string) {
    if (s) this.feed(s);

    let res = this.parser.parse(this.buffer);
    if (res.accept) {
      // update state
      this.errors.push(...res.errors);
      this.buffer = res.buffer;
    }

    return { buffer: this.buffer, accept: res.accept };
  }

  /** Try to reduce till the parser can't accept more. */
  parseAll(s?: string) {
    if (s) this.feed(s);

    /** `true` if accept one or more times. */
    let accept = false;
    while (true) {
      let res = this.parse();
      if (res.accept) accept = true;
      else break;
    }

    return { buffer: this.buffer, accept };
  }

  /** Take the first AST Node out of buffer. */
  take() {
    return this.buffer.shift();
  }
}
