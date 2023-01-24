import { ILexer } from "../../lexer";
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

    this.buffer = this.buffer.concat(
      this.lexer.lexAll().map((t) => ASTNode.from(t))
    );

    const res = this.dfa.parse(this.buffer, stopOnError);
    if (res.accept) {
      // update states
      this.buffer = res.buffer.slice();
      this.errors.push(...res.errors);
    }

    return res;
  }
}
