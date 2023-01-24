import { ILexer } from "../../lexer";
import { BaseParser } from "../base";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";
import { ReLexStack, RollbackStack } from "./model/re-lex";

/** Expectational LR(1) parser. Try to yield a top level NT each time. */
export class Parser<T>
  extends BaseParser<T, DFA<T>, Parser<T>>
  implements IParser<T>
{
  private reLexStack: ReLexStack<T>;
  private rollbackStack: RollbackStack<T>;
  lexer: ILexer;

  constructor(dfa: DFA<T>, lexer: ILexer) {
    super(dfa, lexer, Parser);
    this.reLexStack = [];
    this.rollbackStack = [];
  }

  /** Clear re-lex stack (abandon all other possibilities). */
  commit() {
    this.reLexStack = [];
    this.rollbackStack = [];
    return this;
  }

  reset() {
    return super.reset().commit();
  }

  parse(input = "", stopOnError = false): ParserOutput<T> {
    this.feed(input);

    // important! make sure lexer can still lex something not muted
    if (!this.lexer.trimStart().hasRest()) return { accept: false };

    // clone lexer to avoid DFA changing the original lexer
    const lexerClone = this.lexer.clone();

    const { output, lexer } = this.dfa.parse(
      this.buffer,
      lexerClone,
      this.reLexStack,
      this.rollbackStack,
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
}
