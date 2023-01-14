import { BaseParserContext, GrammarRule } from "../model";
import { BaseCandidate } from "./candidate";

/** Base state for LR and ELR parsers. */
export class BaseState<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx>
> {
  /** Sorted candidates by candidates' string value. */
  readonly candidates: readonly Candidate[];

  constructor(candidates: Candidate[]) {
    this.candidates = candidates.sort((a, b) =>
      a.toString() > b.toString() ? 1 : -1
    );
  }

  contains(gr: Readonly<GrammarRule<T, After, Ctx>>, digested: number) {
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
