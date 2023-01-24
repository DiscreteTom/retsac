import { ILexer } from "../../lexer";
import { ASTNode } from "../ast";
import { BaseParser, Callback } from "../base";
import { IParser, ParserOutput } from "../model";
import { DFA, State } from "./DFA";
import { ParserContext } from "./model";

/** Expectational LR(1) parser. Try to yield a top level NT each time. */
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
    rollbackStackLength: number;
  }[];
  private rollbackStack: Callback<T, string, ParserContext<T>>[];
  private ctxStack: ParserContext<T>[];
  lexer: ILexer;

  constructor(dfa: DFA<T>, lexer: ILexer) {
    super(dfa, lexer, Parser);
    this.reLexStack = [];
    this.rollbackStack = [];
    this.ctxStack = [];
  }

  /** Clear re-lex stack (abandon all other possibilities). */
  commit() {
    this.reLexStack = [];
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
      this.ctxStack,
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
