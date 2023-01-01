import { ILexer } from "./lexer/model";
import { ASTNode } from "./parser/ast";
import { IParser } from "./parser/model";

/**
 * Manager will use a lexer to retrieve tokens,
 * and a parser to reduce buffer and gather errors.
 */
export class Manager<T> {
  private lexer: ILexer;
  private parser: IParser<T>;
  private buffer: ASTNode<T>[];
  private errors: ASTNode<T>[];

  constructor(p: { lexer: ILexer; parser: IParser<T> }) {
    this.lexer = p.lexer;
    this.parser = p.parser;
    this.reset();
  }

  reset() {
    this.buffer = [];
    this.errors = [];
    this.lexer.reset();
    this.parser.reset();
    return this;
  }

  getBuffer() {
    return this.buffer;
  }

  getErrors() {
    return this.errors;
  }

  /** Parse input string to token then to ASTNode and push to buffer. */
  feed(s: string) {
    this.buffer.push(...this.lexer.lexAll(s).map((t) => ASTNode.from<T>(t)));
    return this;
  }

  /** Try to reduce AST nodes once. */
  parse(s?: string) {
    if (s) this.feed(s);

    const res = this.parser.parse(this.buffer);
    if (res.accept) {
      // update state
      this.errors.push(...res.errors);
      this.buffer = res.buffer;
    }

    return res;
  }

  /** Try to reduce till the parser can't accept more. */
  parseAll(s?: string) {
    if (s) this.feed(s);

    const res = this.parser.parseAll(this.buffer);
    if (res.accept) {
      // update state
      this.errors.push(...res.errors);
      this.buffer = res.buffer;
    }

    return res;
  }

  /** Take the first AST Node out of buffer. */
  take() {
    return this.buffer.shift();
  }
}
