import { ASTNode } from "../../ast";
import { BaseParserContext, CandidateClassCtor, GrammarRule } from "../model";

/** Base candidate for LR and ELR parsers. */
export class BaseCandidate<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Child extends BaseCandidate<T, After, Ctx, Child>
> {
  readonly gr: GrammarRule<T, After, Ctx>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  protected nextCache: Map<string, Child | null>;

  constructor(
    data: Pick<BaseCandidate<T, After, Ctx, Child>, "gr" | "digested">,
    private readonly ChildClass: CandidateClassCtor<T, After, Ctx, Child>
  ) {
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

  /**
   * Accept the node and generate next candidate with `digested + 1`.
   *
   * Return `null` if the node can not be accepted.
   */
  getNext(node: Readonly<ASTNode<T>>): Child | null {
    const key = JSON.stringify({ type: node.type, text: node.text });

    // try to get from cache
    const cache = this.nextCache.get(key);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res =
      this.canDigestMore() && this.current.eq(node)
        ? new this.ChildClass({ gr: this.gr, digested: this.digested + 1 })
        : null;
    this.nextCache.set(key, res);
    return res;
  }

  /** Return `NT <= ...before @ ...after`. */
  toString(sep = " ", arrow = "<=", index = "@") {
    return BaseCandidate.getString(this, sep, arrow, index);
  }

  static getString<
    T,
    After,
    Ctx extends BaseParserContext<T, After>,
    Child extends BaseCandidate<T, After, Ctx, Child>
  >(
    data: Pick<BaseCandidate<T, After, Ctx, Child>, "gr" | "digested">,
    sep = " ",
    arrow = "<=",
    index = "@"
  ) {
    return [
      data.gr.NT,
      arrow,
      ...data.gr.rule.slice(0, data.digested).map((r) => r.toString()),
      index,
      ...data.gr.rule.slice(data.digested).map((r) => r.toString()),
    ].join(sep);
  }

  eq(other: { gr: Readonly<GrammarRule<T, After, Ctx>>; digested: number }) {
    return this.gr == other.gr && this.digested === other.digested;
  }
}
