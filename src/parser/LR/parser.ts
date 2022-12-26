import { ASTNode } from "../ast";
import { IParser } from "../model";
import { DFA } from "./DFA";

/** LR(1) parser. Stateless. Try to yield a top level NT each time. */
export class Parser<T> implements IParser<T> {
  dfa: DFA<T>;

  constructor(dfa: DFA<T>) {
    this.dfa = dfa;
  }

  /** Try to yield an entry NT. */
  parse(buffer: ASTNode<T>[], stopOnError = false) {
    return this.dfa.parse(buffer, stopOnError);
  }

  /** Actually this does nothing since each `DFA.parse` will reset itself. */
  reset() {
    // this.dfa.reset();
  }
}
