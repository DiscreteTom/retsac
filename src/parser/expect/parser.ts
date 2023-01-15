import { ILexer } from "../../lexer/model";
import { BaseParser } from "../base";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** Expectational LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T>
  extends BaseParser<T, DFA<T>, Parser<T>>
  implements IParser<T>
{
  lexer: ILexer;

  constructor(dfa: DFA<T>, lexer: ILexer) {
    super(dfa, lexer, Parser);
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
}
