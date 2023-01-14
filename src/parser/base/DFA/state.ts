import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarSet, GrammarRule, GrammarType } from "../model";
import { BaseCandidate } from "./candidate";

/** Base state for LR and ELR parsers. */
export class BaseState<T, After> {
  /** Sorted candidates by candidates' string value. */
  readonly candidates: readonly BaseCandidate<T, After>[];
  protected nextCache: Map<string, BaseState<T, After> | null>;

  /**
   * State should only be created when:
   *
   * 1. DFA create entry state.
   * 2. `State.getNext`.
   *
   * This will ensure that all states are unique and only one instance exists.
   */
  constructor(candidates: BaseCandidate<T, After>[]) {
    this.candidates = candidates.sort((a, b) =>
      a.toString() > b.toString() ? 1 : -1
    );
    this.nextCache = new Map();
  }

  contains(gr: Readonly<GrammarRule<T, After>>, digested: number) {
    return this.candidates.some((c) => c.eq({ gr, digested }));
  }

  /**
   * Get the string representation of this state.
   *
   * Since candidates are sorted, the string representation of this state is unique.
   */
  toString() {
    return this.candidates.map((c) => c.toString()).join("\n");
  }
}
