import { GrammarRule } from "../model";

/** Base candidate for LR and ELR parsers. */
export class BaseCandidate<T, After> {
  readonly gr: GrammarRule<T, After>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;

  constructor(data: Pick<BaseCandidate<T, After>, "gr" | "digested">) {
    Object.assign(this, data);
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
