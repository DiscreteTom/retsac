import { ASTNode } from "../ast";
import { IParser, ParserOutput } from "../model";
import { DFA } from "./DFA";

/** LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T> implements IParser<T> {
  dfa: DFA<T>;

  constructor(dfa: DFA<T>) {
    this.dfa = dfa;
  }

  /** Try to yield an entry NT. */
  parse(buffer: ASTNode<T>[], stopOnError = false): ParserOutput<T> {
    return this.dfa.parse(buffer, stopOnError);
  }

  /** Try to reduce till the parser can't accept more. */
  parseAll(buffer: ASTNode<T>[], stopOnError = false): ParserOutput<T> {
    let lastRes: ParserOutput<T> = {
      accept: false,
    };

    while (true) {
      const res = this.parse(buffer, stopOnError);
      if (res.accept) {
        lastRes = res;
      } else {
        return lastRes;
      }
    }
  }

  /** Actually this does nothing since each `DFA.parse` will reset itself. */
  reset() {
    // this.dfa.reset();
    return this;
  }
}
