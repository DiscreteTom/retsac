import { ILexer } from "../../../lexer/model";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet, GrammarType, ParserContext } from "../model";

/** A.k.a: LR(1) Project. */
export class Candidate<T> {
  readonly gr: GrammarRule<T>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  private nextCache: Map<string, Candidate<T> | null>;

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
  getNext(node: Readonly<ASTNode<T>>): Candidate<T> | null {
    const key = JSON.stringify({ type: node.type, text: node.text });

    // try to get from cache
    const cache = this.nextCache.get(key);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res =
      this.canDigestMore() && this.current.eq(node)
        ? new Candidate({ gr: this.gr, digested: this.digested + 1 })
        : null;
    this.nextCache.set(key, res);
    return res;
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content specified by `this.current`.
   */
  tryLex(lexer: ILexer): ASTNode<T> | null {
    if (this.current.type == GrammarType.NT) {
      return null;
    } else {
      const expectType =
        this.current.type == GrammarType.LITERAL
          ? lexer.dryClone().lex(this.current.content)!.type // lex literal to get type
          : this.current.content;
      const expectContent =
        this.current.type == GrammarType.LITERAL
          ? this.current.content
          : undefined;

      // try to lex to get the token
      const token = lexer.lex({
        expect: { types: [expectType], text: expectContent },
      });
      if (token == null) {
        return null;
      } else {
        return ASTNode.from<T>(token);
      }
    }
  }

  /**
   * Only failed if:
   * 1. Digestion not finished.
   * 2. Check follow set failed.
   * 3. Rejecter rejected.
   */
  tryReduce(
    buffer: readonly ASTNode<T>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: ILexer,
    debug: boolean
  ): ParserOutput<T> {
    if (this.canDigestMore()) return { accept: false };

    const context: ParserContext<T> = {
      matched: buffer.slice(-this.gr.rule.length),
      before: buffer.slice(0, -this.gr.rule.length),
      after: lexer.getRest(),
      lexer,
    };

    // check follow for LR(1) with the rest input string
    if (context.after.length > 0) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else if (
        !followSets
          .get(this.gr.NT)!
          .map((g) =>
            lexer
              .clone() // clone with state to prevent side effect
              .lex({
                expect: {
                  types: [g.toASTNode(lexer).type],
                  text: g.toASTNode(lexer).text,
                },
              })
          )
          .every((x) => x == null)
      ) {
        if (debug)
          console.log(
            `[Follow Mismatch] ${this.gr.toString()} follow=${context.after.slice(
              0,
              10 // only show first 10 chars
            )}`
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
      buffer: context.before.concat(node),
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

  static getString<_>(
    data: Pick<Candidate<_>, "gr" | "digested">,
    sep = " ",
    arrow = "<=",
    index = "@"
  ) {
    return new Candidate(data).toString(sep, arrow, index);
  }

  eq(other: { gr: Readonly<GrammarRule<T>>; digested: number }) {
    return this.gr == other.gr && this.digested === other.digested;
  }
}
