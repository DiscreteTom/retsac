import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet } from "../model";

/** Base candidate for LR and ELR parsers. */
export class BaseCandidate<T, After> {
  readonly gr: GrammarRule<T, After>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  private nextCache: Map<string, BaseCandidate<T, After> | null>;

  /**
   * Candidate should only be created when:
   *
   * 1. Create initial candidates by DFA.
   * 2. Create next candidates by `Candidate.getNext`.
   * 3. Get string value by `Candidate.getString`.
   *
   * This will ensure that all candidates are unique and only one instance exists.
   */
  constructor(data: Pick<BaseCandidate<T, After>, "gr" | "digested">) {
    Object.assign(this, data);
    this.nextCache = new Map();
  }

  /** Current grammar. */
  get current() {
    return this.gr.rule[this.digested];
  }

  canDigestMore() {
    return this.digested < this.gr.rule.length;
  }

  /** Return `NT <= ...before @ ...after`. */
  toString(sep = " ", arrow = "<=", index = "@") {
    return [
      this.gr.NT,
      arrow,
      ...this.gr.rule.slice(0, this.digested).map((r) => r.toString()),
      index,
      ...this.gr.rule.slice(this.digested).map((r) => r.toString()),
    ].join(sep);
  }

  static getString<_, __>(
    data: Pick<BaseCandidate<_, __>, "gr" | "digested">,
    sep = " ",
    arrow = "<=",
    index = "@"
  ) {
    return new BaseCandidate(data).toString(sep, arrow, index);
  }

  eq(other: { gr: Readonly<GrammarRule<T, After>>; digested: number }) {
    return this.gr == other.gr && this.digested === other.digested;
  }
}
