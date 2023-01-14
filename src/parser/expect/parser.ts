import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** Expectational LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T> implements IParser<T> {
  readonly dfa: DFA<T>;
  lexer: ILexer;
  private buffer: ASTNode<T>[];
  private errors: ASTNode<T>[];

  constructor(dfa: DFA<T>, lexer: ILexer) {
    this.dfa = dfa;
    this.lexer = lexer;
    this.buffer = [];
    this.errors = [];
  }

  reset() {
    this.lexer.reset();
    this.buffer = [];
    this.errors = [];
    return this;
  }

  clone() {
    const res = new Parser(this.dfa, this.lexer.clone());
    res.buffer = this.buffer.slice();
    res.errors = this.errors.slice();
    return res;
  }

  dryClone() {
    return new Parser(this.dfa, this.lexer.dryClone());
  }

  feed(input: string): this {
    this.lexer.feed(input);
    return this;
  }

  parse(input = "", stopOnError = false): ParserOutput<T> {
    this.feed(input);

    // clone lexer to avoid DFA changing the original lexer
    const lexerClone = this.lexer.clone();

    const res = this.dfa.parse(this.buffer, lexerClone, stopOnError);
    if (res.accept) {
      // update states
      this.lexer = lexerClone; // lexer is stateful and may be changed in DFA, so we need to update it
      this.buffer = res.buffer;
      this.errors.push(...res.errors);
    }

    return res;
  }

  parseAll(input = "", stopOnError = false): ParserOutput<T> {
    /** Aggregate results if the parser can accept more. */
    const summary: ParserOutput<T> = {
      accept: true,
      buffer: [],
      errors: [],
    };
    /** If the parser has accepted at least once. */
    let accepted = false;

    this.feed(input);

    while (true) {
      const res = this.parse("", stopOnError);
      if (res.accept) {
        accepted = true;
        summary.buffer = res.buffer;
        summary.errors.push(...res.errors);
      } else {
        if (accepted) {
          // at least one accept
          return summary;
        } else {
          return res;
        }
      }
    }
  }

  getErrors(): readonly ASTNode<T>[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getBuffer(): readonly ASTNode<T>[] {
    return this.buffer;
  }
}
