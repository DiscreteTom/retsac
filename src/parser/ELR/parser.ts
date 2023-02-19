import { ILexer } from "../../lexer";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA, State } from "./DFA";
import { ReLexStack, RollbackStack } from "./model";

/** ELR parser. */
export class Parser<T> implements IParser<T> {
  readonly dfa: DFA<T>;
  lexer: ILexer;
  protected buffer: ASTNode<T>[];
  protected errors: ASTNode<T>[];

  private reLexStack: ReLexStack<State<T>, T>;
  private rollbackStack: RollbackStack<T>;

  constructor(dfa: DFA<T>, lexer: ILexer) {
    this.dfa = dfa;
    this.lexer = lexer;
    this.buffer = [];
    this.errors = [];
  }

  /** Clear re-lex stack (abandon all other possibilities). */
  commit() {
    this.reLexStack.length = 0; // clear re-lex stack
    this.rollbackStack.length = 0; // clear rollback stack
    return this;
  }

  reset() {
    // this.dfa.reset(); // DFA is stateless so no need to reset
    this.lexer.reset();
    this.buffer = [];
    this.errors = [];
    return this.commit();
  }

  clone() {
    const res = new Parser<T>(this.dfa, this.lexer.clone());
    res.buffer = [...this.buffer];
    res.errors = [...this.errors];
    return res;
  }

  dryClone() {
    return new Parser<T>(this.dfa, this.lexer.dryClone());
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

  parse(
    input?: string | { input?: string; stopOnError?: boolean }
  ): ParserOutput<T> {
    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input?.stopOnError ?? false;

    // important! make sure lexer can still lex something not muted
    if (!this.lexer.trimStart().hasRest()) return { accept: false };

    // clone lexer to avoid DFA changing the original lexer
    const lexerClone = this.lexer.clone();

    const { output, lexer } = this.dfa.parse(
      this.buffer,
      lexerClone,
      this.reLexStack,
      this.rollbackStack,
      () => this.commit(),
      stopOnError
    );
    if (output.accept) {
      // update states
      this.lexer = lexer; // lexer is stateful and may be changed in DFA, so we need to update it
      this.buffer = output.buffer.slice();
      this.errors.push(...output.errors);
    }

    return output;
  }

  parseAll(
    input: string | { input?: string; stopOnError?: boolean } = ""
  ): ParserOutput<T> {
    let buffer: readonly ASTNode<T>[] = [];
    /** Aggregate results if the parser can accept more. */
    const errors: ASTNode<T>[] = [];
    /** If the parser has accepted at least once. */
    let accepted = false;

    // feed input if provided
    if (typeof input === "string") {
      this.feed(input);
    } else {
      if (input?.input) this.feed(input.input);
    }

    const stopOnError =
      typeof input === "string" ? false : input?.stopOnError ?? false;

    while (true) {
      const res = this.parse({ stopOnError });
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
