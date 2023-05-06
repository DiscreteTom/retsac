import { ILexer } from "../../lexer";
import { Logger } from "../../model";
import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA, State } from "./DFA";
import { ReLexStack, RollbackStack } from "./model";

/** ELR parser. */
export class Parser<T> implements IParser<T> {
  lexer: ILexer;
  readonly dfa: DFA<T>;
  protected buffer: ASTNode<T>[];
  protected errors: ASTNode<T>[];

  private reLexStack: ReLexStack<State<T>, T>;
  private rollbackStack: RollbackStack<T>;

  get debug() {
    return this.dfa.debug;
  }
  set debug(v: boolean) {
    this.dfa.debug = v;
  }
  get logger() {
    return this.dfa.logger;
  }
  set logger(v: Logger) {
    this.dfa.logger = v;
  }

  constructor(dfa: DFA<T>, lexer: ILexer) {
    this.dfa = dfa;
    this.lexer = lexer;
    this.buffer = [];
    this.errors = [];
    this.reLexStack = [];
    this.rollbackStack = [];
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

  clone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Parser<T>(this.dfa, this.lexer.clone());
    res.buffer = [...this.buffer];
    res.errors = [...this.errors];
    res.reLexStack = [...this.reLexStack];
    res.rollbackStack = [...this.rollbackStack];
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
  }

  dryClone(options?: { debug?: boolean; logger?: Logger }) {
    const res = new Parser<T>(this.dfa, this.lexer.dryClone());
    res.debug = options?.debug ?? this.debug;
    res.logger = options?.logger ?? this.logger;
    return res;
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

    // important! make sure lexer can still lex something not muted.
    // DON'T put this in `DFA.parse` because we need to update lexer using `trimStart`.
    // If we put this in `DFA.parse` and parse failed, the lexer won't be updated.
    if (!this.lexer.trimStart().hasRest()) return { accept: false };

    const res = this.dfa.parse(
      this.buffer,
      this.lexer.clone(), // clone lexer to avoid DFA changing the original lexer
      this.reLexStack,
      this.rollbackStack,
      () => this.commit(),
      stopOnError
    );
    if (res.output.accept) {
      // lexer is stateful and may be changed in DFA(e.g. restore from reLexStack)
      // so we need to update it using `res.lexer`
      this.lexer = res.lexer;
      this.buffer = res.output.buffer.slice(); // make a copy of buffer
      this.errors.push(...res.output.errors);
    }

    return res.output;
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
