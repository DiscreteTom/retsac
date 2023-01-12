import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet, ParserContext } from "../model";

/** A.k.a: LR(1) Project. */
export class Candidate<T> {
  readonly gr: GrammarRule<T>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;

  constructor(data: Pick<Candidate<T>, "gr" | "digested">) {
    Object.assign(this, data);
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
  getNext(node: Readonly<ASTNode<T>>): Candidate<T> | null {
    if (this.canDigestMore() && this.current.eq(node))
      return new Candidate({ gr: this.gr, digested: this.digested + 1 });
    return null;
  }

  /**
   * Only failed if:
   * 1. Digestion not finished.
   * 2. Check follow set failed.
   * 3. Rejecter rejected.
   */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    /** From where of the buffer to reduce. */
    index: number,
    entryNTs: Readonly<Set<string>>,
    followSets: Readonly<Map<string, GrammarSet>>,
    debug: boolean
  ): ParserOutput<T> {
    if (this.canDigestMore()) return { accept: false };

    const context: ParserContext<T> = {
      matched: buffer.slice(index + 1 - this.gr.rule.length, index + 1),
      before: buffer.slice(0, index + 1 - this.gr.rule.length),
      after: buffer.slice(index + 1),
    };

    // peek next ASTNode and check follow for LR(1)
    if (context.after.length > 0) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else if (!followSets.get(this.gr.NT)!.has(context.after[0])) {
        if (debug)
          console.log(
            `[Follow Mismatch] ${this.gr.toString()} follow=${context.after[0].toString()}`
          );
        return { accept: false };
      }
      // else, follow set matched, continue
    }

    // check rejecter
    if (this.gr.rejecter(context)) {
      if (debug) console.log(`[Reject] ${this.gr.toString()}`);
      return { accept: false };
    }

    // accept
    this.gr.callback(context);
    const node = new ASTNode({
      type: this.gr.NT,
      children: context.matched,
      data: context.data,
      error: context.error,
      start: context.matched[0].start,
    });
    node.children!.map((c) => (c.parent = node)); // link parent
    if (debug) console.log(`[Accept] ${this.gr.toString()}`);

    return {
      accept: true,
      buffer: context.before.concat(node).concat(context.after),
      errors: context.error ? [node] : [],
    };
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

  eq(other: { gr: Readonly<GrammarRule<T>>; digested: number }) {
    return this.gr == other.gr && this.digested === other.digested;
  }
}
