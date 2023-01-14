import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";

/** Base parser for LR and ELR parsers. */
export class BaseParser<T, DFA, Child extends BaseParser<T, DFA, Child>> {
  readonly dfa: DFA;
  lexer: ILexer;
  protected buffer: ASTNode<T>[];
  protected errors: ASTNode<T>[];
  private ChildClass: new (dfa: DFA, lexer: ILexer) => Child;

  constructor(
    dfa: DFA,
    lexer: ILexer,
    ChildClass: new (dfa: DFA, lexer: ILexer) => Child
  ) {
    this.dfa = dfa;
    this.lexer = lexer;
    this.buffer = [];
    this.errors = [];
    this.ChildClass = ChildClass;
  }

  reset() {
    // this.dfa.reset(); // DFA is stateless so no need to reset
    this.lexer.reset();
    this.buffer = [];
    this.errors = [];
    return this;
  }

  clone() {
    const res = new this.ChildClass(this.dfa, this.lexer.clone());
    res.buffer = [...this.buffer];
    res.errors = [...this.errors];
    return res;
  }

  dryClone() {
    return new this.ChildClass(this.dfa, this.lexer.dryClone());
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
