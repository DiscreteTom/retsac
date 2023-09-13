import { ILexer } from "../../../lexer";
import { Logger } from "../../../logger";
import { ASTNode } from "../../ast";
import {
  AcceptedParserOutput,
  RejectedParserOutput,
  rejectedParserOutput,
} from "../../model";
import {
  GrammarRule,
  GrammarRuleContext,
  ConflictType,
  Grammar,
  GrammarRuleRepo,
} from "../model";
import { ReadonlyFollowSets } from "./model";
import {
  ASTNodeFirstMatchSelectorFactory,
  ASTNodeSelectorFactory,
  lexGrammar,
  map2serializable,
} from "./utils";

/** Candidate for ELR parsers. */
export class Candidate<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> {
  readonly gr: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>;
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
  private readonly nextMap: Map<
    string,
    Candidate<ASTData, ErrorType, Kinds, LexerKinds> | null
  >;

  /**
   * @see {@link Candidate.toString}
   */
  readonly str: string;
  /**
   * @see {@link Candidate.getStrWithGrammarName}
   */
  readonly strWithGrammarName: string;

  /**
   * Only {@link CandidateRepo} should use this constructor.
   */
  constructor(
    data: Pick<
      Candidate<ASTData, ErrorType, Kinds, LexerKinds>,
      "gr" | "digested" | "strWithGrammarName"
    > &
      Partial<Pick<Candidate<ASTData, ErrorType, Kinds, LexerKinds>, "str">>
  ) {
    this.gr = data.gr;
    this.digested = data.digested;
    this.nextMap = new Map();

    this.strWithGrammarName = data.strWithGrammarName;
    this.str = this.strWithGrammarName;
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
   * Generate next candidate with `digested + 1`.
   * The caller should make sure the current grammar match the next node.
   * @return `null` if the this can't digest more.
   */
  generateNext(
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>
  ): Candidate<ASTData, ErrorType, Kinds, LexerKinds> | null {
    if (this.current == undefined) return null;

    const key = this.current.cacheKeyWithoutName.value;

    // try to get from cache
    const cache = this.nextMap.get(key);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res = this.canDigestMore() ? cs.addNext(this) : null;
    this.nextMap.set(key, res);
    return res;
  }

  /**
   * For debug output.
   */
  toString() {
    return this.str;
  }

  /**
   * Return `NT := ...before # ...after`.
   * This is unique for each candidate.
   */
  static getStrWithGrammarName<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string
  >(
    data: Pick<
      Candidate<ASTData, ErrorType, Kinds, LexerKinds>,
      "gr" | "digested"
    >
  ) {
    return [
      data.gr.NT,
      ":=",
      ...data.gr.rule.slice(0, data.digested).map((r) => r.grammarStrWithName),
      "#",
      ...data.gr.rule.slice(data.digested).map((r) => r.grammarStrWithName),
    ].join(" ");
  }

  /**
   * This is used in State to deduplicate candidates.
   */
  // Since there will be temporary candidates, this function can't be removed.
  eq(other: {
    gr: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>;
    digested: number;
  }) {
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
    lexer: Readonly<ILexer<any, LexerKinds>>,
    followSets: ReadonlyFollowSets
  ): {
    node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
    lexer: ILexer<any, LexerKinds>;
  }[] {
    if (this.canDigestMore()) {
      const res = lexGrammar<ASTData, ErrorType, Kinds, LexerKinds>(
        this.current!,
        lexer
      );
      if (res != null) return [res];
      else return [];
    }

    // else, digestion finished, check follow set
    return followSets
      .get(this.gr.NT)!
      .map((g) => lexGrammar<ASTData, ErrorType, Kinds, LexerKinds>(g, lexer))
      .filter((r) => r != null) as {
      node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
      lexer: ILexer<any, LexerKinds>;
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
    buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[],
    entryNTs: ReadonlySet<string>,
    followSets: ReadonlyFollowSets,
    lexer: Readonly<ILexer<any, LexerKinds>>,
    cascadeQueryPrefix: string | undefined,
    debug: boolean,
    logger: Logger
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<ASTData, ErrorType, Kinds | LexerKinds> & {
        context: GrammarRuleContext<ASTData, ErrorType, Kinds, LexerKinds>;
        commit: boolean;
      }) {
    if (this.canDigestMore()) return rejectedParserOutput;

    const matched = buffer.slice(-this.gr.rule.length);
    matched.forEach((n, i) => (n.name = this.gr.rule[i].name)); // temp set name
    const rollbackNames = () => matched.forEach((n) => (n.name = n.kind)); // rollback the name

    const selector = ASTNodeSelectorFactory<
      ASTData,
      ErrorType,
      Kinds | LexerKinds
    >(cascadeQueryPrefix);
    const firstMatchSelector = ASTNodeFirstMatchSelectorFactory<
      ASTData,
      ErrorType,
      Kinds | LexerKinds
    >(cascadeQueryPrefix);
    const context = new GrammarRuleContext<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >({
      matched,
      lexer,
      beforeFactory: () => buffer.slice(0, -this.gr.rule.length),
      selector,
      firstMatchSelector,
    });

    // check follow for LR(1) with the rest input string
    // important! make sure lexer can still lex something not muted
    // otherwise, we will get stuck because lexer will always return null and follow set check will always fail
    const nextTokenExists = lexer.lex({ peek: true }) != null; // TODO: ensure lexer is already trimmed to optimize perf?
    if (nextTokenExists) {
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
          if (debug)
            logger(
              // don't use context.after here to optimize performance
              `[Follow Mismatch] ${this.gr} follow=${context.lexer.buffer.slice(
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
    for (const c of this.gr.conflicts) {
      // check EOF for RR conflict
      if (c.type == ConflictType.REDUCE_REDUCE) {
        // if reach end of input
        if (!nextTokenExists) {
          // if the end needs to be handled
          if (c.handleEnd) {
            // find the resolver
            const r = this.gr.resolved.find(
              // use find instead of filter here since there can only be one end handler
              (r) =>
                r.type == ConflictType.REDUCE_REDUCE &&
                r.anotherRule == c.anotherRule &&
                r.handleEnd
            )!;
            // if not accepted, reject
            if (
              !(r.accepter instanceof Function
                ? r.accepter(context)
                : r.accepter)
            ) {
              rollbackNames();
              if (debug) logger(`[Reject by Conflict] ${this.gr}`);
              return rejectedParserOutput;
            }
            // else, accepted, continue
          }
          // else, no need to handle end, continue
        }
        // else, not reach to end of input, continue
      }

      // check if any next grammar match the next token
      // no matter if it's RR or SR conflict
      if (!nextTokenExists) continue; // skip if no next token
      let reject = false;
      for (const g of c.next.grammars.values()) {
        const token = context.lexer.lex({
          // peek with expectation
          peek: true,
          expect: {
            kind: g.kind,
            text: g.text,
          },
        });
        if (token == null) continue; // next not match, check next next
        for (const r of c.resolvers) {
          // find related resolver by the next
          if (r.next == "*" || r.next.has(g)) {
            // resolver's next match, check accepter
            if (
              !(r.accepter instanceof Function
                ? r.accepter(context)
                : r.accepter)
            ) {
              reject = true;
              break; // stop check resolvers
            }
          }
        }
        if (reject) break;
      }
      if (reject) {
        rollbackNames();
        if (debug) logger(`[Reject by Conflict] ${this.gr}`);
        return rejectedParserOutput;
      }
      // else, next not match, continue
    }

    // check rejecter
    if (this.gr.rejecter?.(context) ?? false) {
      if (debug) logger(`[Reject] ${this.gr}`);
      rollbackNames();
      return rejectedParserOutput;
    }

    // accept
    this.gr.callback?.(context);
    const node = new ASTNode<ASTData, ErrorType, Kinds | LexerKinds>({
      kind: this.gr.NT,
      children: matched,
      data: context.data,
      error: context.error,
      start: matched[0].start,
      traverser: this.gr.traverser,
      selector,
      firstMatchSelector,
    });
    node.children!.forEach((c) => (c.parent = node)); // link parent
    if (debug) logger(`[Accept] ${this.gr}`);

    return {
      accept: true,
      buffer: context.before.concat(node),
      errors: context.error ? [node] : [],
      context,
      commit: this.gr.commit?.(context) ?? false,
    };
  }

  toJSON(
    grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
    cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>
  ) {
    return {
      gr: grs.getKey(this.gr),
      digested: this.digested,
      nextMap: map2serializable(this.nextMap, (c) =>
        c == null ? null : cs.getKey(c)
      ),
      str: this.str,
      strWithGrammarName: this.strWithGrammarName,
    };
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string
  >(
    data: ReturnType<
      Candidate<ASTData, ErrorType, Kinds, LexerKinds>["toJSON"]
    >,
    grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>
  ) {
    const c = new Candidate<ASTData, ErrorType, Kinds, LexerKinds>({
      gr: grs.getByString(data.gr)!,
      digested: data.digested,
      strWithGrammarName: data.strWithGrammarName,
      str: data.str,
    });

    // restore next map after the whole candidate repo is filled
    const restoreNextMap = (
      cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next == null) c.nextMap.set(key, null);
        else c.nextMap.set(key, cs.getByString(next)!);
      }
    };

    return { c, restoreNextMap };
  }
}

export class CandidateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> {
  /**
   * Candidates. {@link Candidate.strWithGrammarName} => {@link Candidate}
   */
  private cs: Map<string, Candidate<ASTData, ErrorType, Kinds, LexerKinds>>;

  constructor() {
    this.cs = new Map();
  }

  getKey(
    c: Pick<Candidate<ASTData, ErrorType, Kinds, LexerKinds>, "gr" | "digested">
  ) {
    return c instanceof Candidate
      ? c.strWithGrammarName
      : Candidate.getStrWithGrammarName(c);
  }

  get(
    c: Pick<Candidate<ASTData, ErrorType, Kinds, LexerKinds>, "gr" | "digested">
  ) {
    return this.cs.get(this.getKey(c));
  }

  getByString(str: string) {
    return this.cs.get(str);
  }

  getInitial(gr: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>) {
    return this.get({ gr, digested: 0 });
  }

  /**
   * If already exists, return `undefined`.
   */
  addInitial(gr: GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>) {
    const raw = { gr, digested: 0 };
    const key = this.getKey(raw);
    if (this.cs.has(key)) return undefined;

    const c = new Candidate<ASTData, ErrorType, Kinds, LexerKinds>({
      ...raw,
      strWithGrammarName: key,
    });
    this.cs.set(key, c);
    return c;
  }

  /**
   * If already exists, return the cache, else create a new one and return.
   */
  addNext(c: Candidate<ASTData, ErrorType, Kinds, LexerKinds>) {
    const raw = { gr: c.gr, digested: c.digested + 1 };
    const key = this.getKey(raw);
    const cache = this.cs.get(key);
    if (cache != undefined) return cache;

    const next = new Candidate<ASTData, ErrorType, Kinds, LexerKinds>({
      ...raw,
      strWithGrammarName: key,
    });
    this.cs.set(key, next);
    return next;
  }

  toJSON(grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>) {
    const res = [] as ReturnType<
      Candidate<ASTData, ErrorType, Kinds, LexerKinds>["toJSON"]
    >[];
    this.cs.forEach((c) => res.push(c.toJSON(grs, this)));
    return res;
  }

  static fromJSON<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string
  >(
    data: ReturnType<
      CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>["toJSON"]
    >,
    grs: GrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>
  ) {
    const callbacks = [] as ((
      cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>
    ) => void)[];
    const res = new CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>();
    data.forEach((d) => {
      const { c, restoreNextMap } = Candidate.fromJSON<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds
      >(d, grs);
      callbacks.push(restoreNextMap);
      res.cs.set(c.strWithGrammarName, c);
    });
    // restore next map after the whole candidate repo is filled
    callbacks.forEach((c) => c(res));
    return res;
  }
}

export type ReadonlyCandidateRepo<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = Omit<
  CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  "addNext" | "addInitial"
>;
