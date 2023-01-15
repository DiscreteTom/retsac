import { ILexer } from "../../lexer/model";
import { ASTNode } from "../ast";
import { BaseParser } from "../base";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** LR(1) parser. Try to yield a top level NT each time. */
export class Parser<T>
  extends BaseParser<T, DFA<T>, Parser<T>>
  implements IParser<T>
{
  constructor(dfa: DFA<T>, lexer: ILexer) {
    super(dfa, lexer, Parser);
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
}
