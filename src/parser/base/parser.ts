import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** Base parser for LR and ELR parsers. */
export class BaseParser<T, After> {
  readonly dfa: DFA<T, After>;
  readonly lexer: ILexer;
  private buffer: ASTNode<T>[];
  private errors: ASTNode<T>[];

  constructor(dfa: DFA<T, After>, lexer: ILexer) {
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
    const res = new BaseParser(this.dfa, this.lexer.clone());
    res.buffer = [...this.buffer];
    res.errors = [...this.errors];
    return res;
  }

  dryClone() {
    return new BaseParser(this.dfa, this.lexer.dryClone());
  }

  feed(input: string) {
    this.lexer.feed(input);
    return this;
  }

  getErrors(): readonly ASTNode<T>[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getNodes(): readonly ASTNode<T>[] {
    return this.buffer;
  }

  take() {
    return this.buffer.shift();
  }
}
