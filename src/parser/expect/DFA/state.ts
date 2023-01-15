import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { GrammarSet } from "../../base";
import { BaseState } from "../../base/DFA/state";
import { ParserOutput } from "../../model";
import { ParserContext } from "../model";
import { Candidate } from "./candidate";

/** LR(1) state machine's state. */
export class State<T> extends BaseState<
  T,
  string,
  ParserContext<T>,
  Candidate<T>,
  State<T>
> {
  /**
   * State should only be created when:
   *
   * 1. DFA create entry state.
   * 2. `State.getNext`.
   *
   * This will ensure that all states are unique and only one instance exists.
   */
  constructor(candidates: Candidate<T>[]) {
    super(candidates, State);
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content needed by a candidate.
   */
  tryLex(
    lexer: ILexer,
    followSets: ReadonlyMap<string, GrammarSet>
  ): ASTNode<T> | null {
    // try to use lexer to yield an ASTNode with specific type and/or content
    for (let i = 0; i < this.candidates.length; ++i) {
      const node = this.candidates[i].tryLex(lexer, followSets);
      if (node !== null) {
        // for now we only consider the first candidate that can lex the input
        return node;
        // TODO: what if multiple candidates can lex the input?
      }
    }

    // no candidate can lex the input, return null
    return null;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: ILexer,
    debug: boolean
  ): ParserOutput<T> {
    for (const c of this.candidates) {
      const res = c.tryReduce(buffer, entryNTs, followSets, lexer, debug);
      if (res.accept) return res;
    }

    return { accept: false };
  }
}
