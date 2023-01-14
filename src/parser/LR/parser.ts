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

  parseAll(input = "", stopOnError = false): ParserOutput<T> {
    /** Aggregate results if the parser can accept more. */
    const summary: ParserOutput<T> = {
      accept: true,
      buffer: [],
      errors: [],
    };
    /** If the parser has accepted at least once. */
    let accepted = false;

    this.feed(input);

    while (true) {
      const res = this.parse("", stopOnError);
      if (res.accept) {
        accepted = true;
        summary.buffer = res.buffer;
        summary.errors.push(...res.errors);
      } else {
        if (accepted) {
          // at least one accept
          return summary;
        } else {
          return res;
        }
      }
    }
  }
}
