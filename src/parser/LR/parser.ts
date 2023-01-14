import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** LR(1) parser. Try to yield a top level NT each time. */
export class Parser<T> implements IParser<T> {
  readonly dfa: DFA<T>;
  readonly lexer: ILexer;
  private buffer: ASTNode<T>[];
  private errors: ASTNode<T>[];

  constructor(dfa: DFA<T>, lexer: ILexer) {
    this.dfa = dfa;
    this.lexer = lexer;
    this.buffer = [];
    this.errors = [];
  }

  reset() {
    // this.dfa.reset(); // DFA is stateless so no need to reset
    this.lexer.reset();
    this.buffer = [];
    this.errors = [];
    return this;
  }

  clone() {
    const res = new Parser(this.dfa, this.lexer.clone());
    res.buffer = [...this.buffer];
    res.errors = [...this.errors];
    return res;
  }

  dryClone() {
    return new Parser(this.dfa, this.lexer.dryClone());
  }

  feed(input: string) {
    this.lexer.feed(input);
    return this;
  }

  parse(input = "", stopOnError = false): ParserOutput<T> {
    this.buffer = this.buffer.concat(
      this.lexer.lexAll(input).map((t) => ASTNode.from(t))
    );

    const res = this.dfa.parse(this.buffer, stopOnError);
    if (res.accept) {
      // update states
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
