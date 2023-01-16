import { ILexer } from "../../lexer";
import { ASTNode } from "../ast";
import { BaseParser } from "../base";
import { IParser, ParserOutput } from "../model";
import { DFA, State } from "./DFA";

/** Expectational LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T>
  extends BaseParser<T, DFA<T>, Parser<T>>
  implements IParser<T>
{
  private reLexStack: {
    stateStack: State<T>[];
    buffer: ASTNode<T>[];
    lexer: ILexer;
    index: number;
    errors: ASTNode<T>[];
  }[];
  lexer: ILexer;

  constructor(dfa: DFA<T>, lexer: ILexer) {
    super(dfa, lexer, Parser);
    this.reLexStack = [];
  }

  reset() {
    super.reset();
    this.reLexStack = [];
    return this;
  }

  parse(input = "", stopOnError = false): ParserOutput<T> {
    this.feed(input);

    if (!this.lexer.hasRest()) return { accept: false };

    // clone lexer to avoid DFA changing the original lexer
    const lexerClone = this.lexer.clone();

    const { output, lexer } = this.dfa.parse(
      this.buffer,
      lexerClone,
      this.reLexStack,
      stopOnError
    );
    if (output.accept) {
      // update states
      this.lexer = lexer; // lexer is stateful and may be changed in DFA, so we need to update it
      this.buffer = output.buffer;
      this.errors.push(...output.errors);
    }

    return output;
  }
}
