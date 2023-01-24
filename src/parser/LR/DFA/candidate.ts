import { ASTNode } from "../../ast";
import { GrammarSet } from "../../base";
import { BaseCandidate } from "../../base/DFA";
import { ParserOutput } from "../../model";
import { LRParserContext } from "../model";

/** A.k.a: LR(1) Project. */
export class Candidate<T> extends BaseCandidate<
  T,
  ASTNode<T>[],
  LRParserContext<T>,
  Candidate<T>
> {
  /**
   * Candidate should only be created when:
   *
   * 1. Create initial candidates by DFA.
   * 2. Create next candidates by `Candidate.getNext`.
   * 3. Get string value by `Candidate.getString`.
   *
   * This will ensure that all candidates are unique and only one instance exists.
   */
  constructor(data: Pick<Candidate<T>, "gr" | "digested">) {
    super(data, Candidate);
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
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    debug: boolean
  ): ParserOutput<T> {
    if (this.canDigestMore()) return { accept: false };

    const context: LRParserContext<T> = {
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
}
