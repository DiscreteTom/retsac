import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { defToTempGRs } from "../builder/utils/definition";
import {
  Grammar,
  GrammarRule,
  GrammarSet,
  GrammarType,
  ParserContext,
} from "../model";

/** Candidate for ELR parsers. */
export class Candidate<T> {
  readonly gr: GrammarRule<T>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  protected nextCache: Map<string, Candidate<T> | null>;

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
        ? new Candidate<T>({ gr: this.gr, digested: this.digested + 1 })
        : null;
    this.nextCache.set(key, res);
    return res;
  }

  /** Return `NT <= ...before @ ...after`. */
  toString(sep = " ", arrow = "<=", index = "@") {
    return Candidate.getString(this, sep, arrow, index);
  }

  static getString<T>(
    data: Pick<Candidate<T>, "gr" | "digested">,
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

  eq(other: { gr: Readonly<GrammarRule<T>>; digested: number }) {
    return this.gr == other.gr && this.digested === other.digested;
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content specified by `this.current`.
   * Return all the possible results.
   */
  tryLex(
    lexer: ILexer,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<T>; lexer: ILexer }[] {
    if (this.canDigestMore()) {
      const res = lexGrammar<T>(this.current, lexer);
      if (res != null) return [{ node: res, lexer }];
      else return [];
    }

    // else, digestion finished, check follow set
    const followSet = followSets.get(this.gr.NT)!;
    return followSet
      .map((g) => {
        const l = lexer.clone(); // clone lexer to avoid side effect
        return {
          node: lexGrammar<T>(g, l),
          lexer: l,
        };
      })
      .filter((r) => r.node != null) as { node: ASTNode<T>; lexer: ILexer }[];
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
  ): { res: ParserOutput<T>; context?: ParserContext<T>; commit?: boolean } {
    if (this.canDigestMore()) return { res: { accept: false } };

    const context: ParserContext<T> = {
      matched: buffer.slice(-this.gr.rule.length),
      before: buffer.slice(0, -this.gr.rule.length),
      after: lexer.getRest(),
      lexer,
      $: (name, index = 0) => {
        const matched = context.matched;
        for (let i = 0; i < matched.length; i++) {
          if (
            defToTempGRs({ "": name })[0]?.rule[0]?.eq(matched[i]) &&
            index-- === 0
          )
            return matched[i];
        }
        return undefined;
      },
    };

    // check follow for LR(1) with the rest input string
    if (
      context.after.length > 0 &&
      // important! make sure lexer can still lex something not muted
      // otherwise, we will get stuck because lexer will always return null and follow set check will always fail
      lexer.clone().trimStart().hasRest()
    ) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else if (
        followSets
          .get(this.gr.NT)!
          .map((g) =>
            lexer
              .clone() // clone with state to prevent side effect
              .lex({
                expect: {
                  type: g.toASTNode(lexer).type,
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
        return { res: { accept: false } };
      }
      // else, follow set matched, continue
    }

    // check rejecter
    if (this.gr.rejecter(context)) {
      if (debug) console.log(`[Reject] ${this.gr.toString()}`);
      return { res: { accept: false } };
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
      res: {
        accept: true,
        buffer: context.before.concat(node),
        errors: context.error ? [node] : [],
      },
      context,
      commit: this.gr.commit(context),
    };
  }
}

function lexGrammar<T>(g: Grammar, lexer: ILexer): ASTNode<T> | null {
  if (g.type == GrammarType.NT) {
    return null;
  } else {
    // try to lex to get the token
    const token = lexer.lex({
      expect: {
        type: g.toASTNode(lexer).type,
        text: g.toASTNode(lexer).text,
      },
    });
    if (token == null) {
      return null;
    } else {
      return ASTNode.from<T>(token);
    }
  }
}