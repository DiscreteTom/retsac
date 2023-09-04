import { ILexer } from "../../../lexer";
import { Logger } from "../../../model";
import { ASTNode } from "../../ast";
import {
  AcceptedParserOutput,
  RejectedParserOutput,
  rejectedParserOutput,
} from "../../model";
import {
  GrammarRule,
  GrammarSet,
  GrammarRuleContext,
  ConflictType,
  Grammar,
} from "../model";
import { ASTNodeSelectorFactory, lexGrammar } from "./utils";

/** Candidate for ELR parsers. */
export class Candidate<ASTData, Kinds extends string> {
  readonly gr: Readonly<GrammarRule<ASTData, Kinds>>;
  /**
   * How many grammars are already matched in `this.gr`.
   */
  readonly digested: number;
  /**
   * `ASTNode.toString => candidate`.
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   */
  // don't use `undefined` here
  // because `Map.get` return `undefined` when key not found
  private readonly nextMap: Map<string, Candidate<ASTData, Kinds> | null>;

  constructor(data: Pick<Candidate<ASTData, Kinds>, "gr" | "digested">) {
    this.gr = data.gr;
    this.digested = data.digested;
    this.nextMap = new Map();
  }

  /**
   * Current undigested grammar.
   * Use this to match the next node.
   */
  get current(): Grammar | undefined {
    return this.gr.rule[this.digested];
  }

  canDigestMore() {
    return this.digested < this.gr.rule.length;
  }

  /**
   * Try to accept the node and generate next candidate with `digested + 1`.
   *
   * Return `null` if the node can't be accepted or this can't digest more.
   */
  getNext(node: Readonly<ASTNode<any, any>>): Candidate<ASTData, Kinds> | null {
    if (this.current == undefined) return null;

    const key = this.current.calculateCacheKey(node);

    // try to get from cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res =
      this.canDigestMore() && this.current.match(node)
        ? new Candidate<ASTData, Kinds>({
            gr: this.gr,
            digested: this.digested + 1,
          }) // TODO: CandidateRepo?
        : null;
    this.nextMap.set(key, res);
    return res;
  }

  /**
   * Return `NT := ...before # ...after`.
   * Grammar's name will NOT be used.
   * The result will be cached for future use.
   */
  toString() {
    return this.str ?? (this.str = Candidate.getString(this));
  }
  private str?: string;
  /**
   * Return `NT := ...before # ...after`.
   * Grammar's name will NOT be used.
   */
  static getString<ASTData, Kinds extends string>(
    data: Pick<Candidate<ASTData, Kinds>, "gr" | "digested">
  ) {
    return [
      data.gr.NT,
      ":=",
      ...data.gr.rule.slice(0, data.digested).map((r) => r.toGrammarString()),
      "#",
      ...data.gr.rule.slice(data.digested).map((r) => r.toGrammarString()),
    ].join(" ");
  }

  /**
   * Return `NT := ...before # ...after`.
   * Grammar's name will be used.
   * This is unique for each candidate.
   * The result will be cached for future use.
   */
  toStringWithGrammarName() {
    return (
      this.strWithGrammarName ??
      (this.strWithGrammarName = Candidate.getStringWithGrammarName(this))
    );
  }
  private strWithGrammarName?: string;
  /**
   * Return `NT := ...before # ...after`.
   */
  static getStringWithGrammarName<ASTData, Kinds extends string>(
    data: Pick<Candidate<ASTData, Kinds>, "gr" | "digested">
  ) {
    return [
      data.gr.NT,
      ":=",
      ...data.gr.rule
        .slice(0, data.digested)
        .map((r) => r.toGrammarStringWithName()),
      "#",
      ...data.gr.rule
        .slice(data.digested)
        .map((r) => r.toGrammarStringWithName()),
    ].join(" ");
  }

  /**
   * This is used in State to deduplicate candidates.
   */
  // TODO: remove this? since CandidateRepo should make sure no duplicate candidates
  eq(other: { gr: Readonly<GrammarRule<ASTData, Kinds>>; digested: number }) {
    return (
      this == other || // same object
      (this.gr == other.gr && // grammar rules are only created when build DFA, no temp grammar rules, so we can use object equality here
        this.digested === other.digested)
    );
  }

  /**
   * Try to use lexer to yield an ASTNode with type and/or content specified by `this.current`.
   * If this already digested all the grammar rules, check follow set.
   * Return all the possible results.
   */
  tryLex(
    lexer: Readonly<ILexer<any, any>>,
    followSets: ReadonlyMap<string, GrammarSet>
  ): { node: ASTNode<ASTData, Kinds>; lexer: ILexer<any, any> }[] {
    if (this.canDigestMore()) {
      const res = lexGrammar<ASTData, Kinds>(this.current!, lexer);
      if (res != null) return [res];
      else return [];
    }

    // else, digestion finished, check follow set
    return followSets
      .get(this.gr.NT)!
      .map((g) => lexGrammar<ASTData, Kinds>(g, lexer))
      .filter((r) => r != null) as {
      node: ASTNode<ASTData, Kinds>;
      lexer: ILexer<any, any>;
    }[];
  }

  /**
   * Only failed if:
   * 1. Digestion not finished.
   * 2. Check follow set failed.
   * 3. Reject by conflict resolver.
   * 4. Rejecter rejected.
   */
  tryReduce(
    buffer: readonly ASTNode<ASTData, Kinds>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyMap<string, GrammarSet>,
    lexer: Readonly<ILexer<any, any>>,
    cascadeQueryPrefix: string | undefined,
    logger: Logger
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<ASTData, Kinds> & {
        context: GrammarRuleContext<ASTData, Kinds>;
        commit: boolean;
      }) {
    if (this.canDigestMore()) return rejectedParserOutput;

    const matched = buffer.slice(-this.gr.rule.length);
    matched.forEach((n, i) => (n.name = this.gr.rule[i].name)); // temp set name
    const rollbackNames = () => matched.forEach((n) => (n.name = n.kind)); // rollback the name

    const selector = ASTNodeSelectorFactory<ASTData, Kinds>(cascadeQueryPrefix);
    const context = new GrammarRuleContext<ASTData, Kinds>({
      matched,
      lexer,
      beforeFactory: () => buffer.slice(0, -this.gr.rule.length),
      selector,
    });

    // check follow for LR(1) with the rest input string
    if (
      // important! make sure lexer can still lex something not muted
      // otherwise, we will get stuck because lexer will always return null and follow set check will always fail
      lexer.lex({ peek: true }) != null // TODO: ensure lexer is already trimmed
    ) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else {
        let mismatch = true; // if follow mismatch, reject
        for (const [_, g] of followSets.get(this.gr.NT)!.grammars) {
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
            // found valid follow, continue
            mismatch = false;
            break;
          }
        }
        if (mismatch) {
          logger(
            // TODO: use callback
            // don't use context.after here to optimize performance
            `[Follow Mismatch] ${this.gr.toStringWithGrammarName()} follow=${context.lexer.buffer.slice(
              context.lexer.digested,
              context.lexer.digested + 10 // only show first 10 chars
            )}`
          );
          rollbackNames();
          return rejectedParserOutput;
        }
      }
      // else, follow set matched, continue
    }

    // check conflicts
    for (const r of this.gr.resolved) {
      // check EOF for RR conflict
      if (r.type == ConflictType.REDUCE_REDUCE) {
        // if reach end of input
        if (!context.lexer.hasRest()) {
          // if handle the end of input
          if (r.handleEnd) {
            // if not accepted, reject
            if (
              !(r.accepter instanceof Function
                ? r.accepter(context)
                : r.accepter)
            ) {
              rollbackNames();
              logger(
                `[Reject by Resolved Conflict] ${this.gr.toStringWithGrammarName()}`
              );
              return rejectedParserOutput;
            }
            // else, accepted, continue
          }
          // else, not handle end, continue
        }
        // else, not reach to end of input, continue
      }

      // check if any next grammar match the next token
      // no matter if it's RR or SR conflict
      if (
        r.next == "*" ||
        r.next.some(
          (g) =>
            context.lexer.lex({
              // peek with expectation
              peek: true,
              expect: {
                kind: g.kind,
                text: g.text,
              },
            }) != null
        )
      ) {
        // next match, check accepter
        if (
          !(r.accepter instanceof Function ? r.accepter(context) : r.accepter)
        ) {
          // reject
          rollbackNames();
          logger(
            `[Reject by Resolved Conflict] ${this.gr.toStringWithGrammarName()}`
          );
          return rejectedParserOutput;
        }
        // else, accepted, continue
      }
      // else, next not match, continue
    }

    // check rejecter
    if (this.gr.rejecter?.(context) ?? false) {
      logger(`[Reject] ${this.gr.toStringWithGrammarName()}`);
      rollbackNames();
      return rejectedParserOutput;
    }

    // accept
    this.gr.callback?.(context);
    const node = new ASTNode<ASTData, Kinds>({
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
      accept: true,
      buffer: context.before.concat(node),
      errors: context.error ? [node] : [],
      context,
      commit: this.gr.commit?.(context) ?? false,
    };
  }
}
