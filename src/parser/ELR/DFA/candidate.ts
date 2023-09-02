import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet, GrammarRuleContext } from "../model";
import { ASTNodeSelectorFactory, lexGrammar } from "./utils";

/** Candidate for ELR parsers. */
export class Candidate<T> {
  readonly gr: Readonly<GrammarRule<T>>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  /**
   * `ast node str => candidate`.
   * This will be calculated during `DFA.calculateAllStates`.
   */
  protected readonly nextMap: Map<string, Candidate<T> | null>;
  /** Cache the string representation. */
  private str?: string;

  constructor(data: Pick<Candidate<T>, "gr" | "digested">) {
    Object.assign(this, data);
    this.nextMap = new Map();
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
  getNext(node: Readonly<ASTNode<any>>): Candidate<T> | null {
    const key = node.toUniqueString();

    // try to get from cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res =
      this.canDigestMore() && this.current.match(node)
        ? new Candidate<T>({ gr: this.gr, digested: this.digested + 1 })
        : null;
    this.nextMap.set(key, res);
    return res;
  }

  /**
   * Return `NT <= ...before @ ...after`.
   * The result will be cached for future use.
   */
  toString() {
    return this.str ?? (this.str = Candidate.getString(this));
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
      ...data.gr.rule.slice(0, data.digested).map((r) => r.toGrammarString()),
      index,
      ...data.gr.rule.slice(data.digested).map((r) => r.toGrammarString()),
    ].join(sep);
  }

  eq(other: { gr: Readonly<GrammarRule<T>>; digested: number }) {
    return (
      this.gr == other.gr && // grammar rules are only created when build DFA, no temp grammar rules, so we can use object equality here
      this.digested === other.digested
    );
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content specified by `this.current`.
   * Return all the possible results.
   */
  tryLex(
    lexer: ILexer<any>,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<T>; lexer: ILexer<any> }[] {
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
      .filter((r) => r.node != null) as {
      node: ASTNode<T>;
      lexer: ILexer<any>;
    }[];
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
    lexer: ILexer<any>,
    cascadeQueryPrefix: string | undefined,
    logger: Logger
  ): {
    res: ParserOutput<T>;
    context?: GrammarRuleContext<T>;
    commit?: boolean;
  } {
    if (this.canDigestMore()) return { res: { accept: false } };

    const matched = buffer.slice(-this.gr.rule.length);
    matched.forEach((n, i) => (n.name = this.gr.rule[i].name)); // temp set name
    const rollbackNames = () => matched.forEach((n) => (n.name = n.kind)); // rollback the name

    const selector = ASTNodeSelectorFactory<T>(cascadeQueryPrefix);
    const context = new GrammarRuleContext<T>({
      matched,
      lexer,
      beforeFactory: () => buffer.slice(0, -this.gr.rule.length),
      selector,
    });

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
      } else {
        let mismatch = true;
        for (const g of followSets.get(this.gr.NT)!.toArray()) {
          if (
            lexer.lex({
              // peek with expectation
              peek: true,
              expect: {
                kind: g.kind,
                text: g.text,
              },
            }) != null
          ) {
            mismatch = false;
            break;
          }
        }
        if (mismatch) {
          logger(
            `[Follow Mismatch] ${this.gr.toStringWithGrammarName()} follow=${context.after.slice(
              0,
              10 // only show first 10 chars
            )}`
          );
          rollbackNames();
          return { res: { accept: false } };
        }
      }
      // else, follow set matched, continue
    }

    // TODO: check conflicts

    // check rejecter
    if (this.gr.rejecter(context)) {
      logger(`[Reject] ${this.gr.toStringWithGrammarName()}`);
      rollbackNames();
      return { res: { accept: false } };
    }

    // accept
    this.gr.callback(context);
    const node = new ASTNode({
      kind: this.gr.NT,
      children: matched,
      data: context.data,
      error: context.error,
      start: matched[0].start,
      traverser: this.gr.traverser,
      selector,
    });
    node.children!.forEach((c) => (c.parent = node)); // link parent
    logger(`[Accept] ${this.gr.toStringWithGrammarName()}`);

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
