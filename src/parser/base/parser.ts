import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";

/** Base parser for LR and ELR parsers. */
export abstract class BaseParser<
  T,
  DFA,
  Child extends BaseParser<T, DFA, Child>
> implements IParser<T>
{
  readonly dfa: DFA;
  lexer: ILexer;
  protected buffer: ASTNode<T>[];
  protected errors: ASTNode<T>[];

  constructor(
    dfa: DFA,
    lexer: ILexer,
    private readonly ChildClass: new (dfa: DFA, lexer: ILexer) => Child
  ) {
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

  abstract parse(input?: string, stopOnError?: boolean): ParserOutput<T>;

  parseAll(input = "", stopOnError = false): ParserOutput<T> {
    let buffer: readonly ASTNode<T>[] = [];
    /** Aggregate results if the parser can accept more. */
    const errors: ASTNode<T>[] = [];
    /** If the parser has accepted at least once. */
    let accepted = false;

    this.feed(input);

    while (true) {
      const res = this.parse("", stopOnError);
      if (res.accept) {
        accepted = true;
        buffer = res.buffer;
        errors.push(...res.errors);
      } else {
        if (accepted) {
          // at least one accept
          return { accept: true, buffer, errors };
        } else {
          return res;
        }
      }
    }
  }
}
