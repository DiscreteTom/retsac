import type { CandidateRepo, ReadonlyCandidateRepo } from "./candidate-repo";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  IReadonlyTrimmedLexer,
  Token,
} from "../../../../lexer";
import type { Logger } from "../../../../logger";
import type { ASTNode } from "../../../ast";
import { NTNode } from "../../../ast";
import type {
  RejectedParserOutput,
  AcceptedParserOutput,
} from "../../../output";
import { rejectedParserOutput } from "../../../output";
import type {
  GrammarRule,
  Grammar,
  ReadonlyGrammarRuleRepo,
  GrammarRepo,
} from "../../model";
import { GrammarRuleContext, ConflictType } from "../../model";
import type { ReadonlyFollowSets } from "../model";
import { map2serializable, prettierLexerRest } from "../utils";
import type {
  ASTNodeFirstMatchSelector,
  ASTNodeSelector,
} from "../../../selector";

/**
 * @see {@link Candidate.id}.
 */
export type CandidateID = string & NonNullable<unknown>; // same as string, but won't be inferred as string literal (new type pattern)

/** Candidate for ELR parsers. */
export class Candidate<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> {
  readonly gr: Readonly<
    GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;
  /**
   * How many grammars are already matched in `this.gr`.
   */
  readonly digested: number;
  /**
   * This will be calculated during `DFA.calculateAllStates`.
   * `null` means the node can not be accepted.
   *
   * Since we have GrammarRepo to store all grammars,
   * we can use Grammar as the key of this map.
   */
  private readonly nextMap: Map<
    Grammar<NTs | ExtractKinds<LexerDataBindings>>,
    Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    > | null // don't use `undefined` here because `Map.get` return `undefined` when key not found
  >;

  /**
   * Format: `digested#grammarRuleId`.
   */
  readonly id: CandidateID;

  /**
   * Only {@link CandidateRepo} should use this constructor.
   */
  constructor(
    data: Pick<
      Candidate<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
      "gr" | "digested" | "id"
    >,
  ) {
    this.gr = data.gr;
    this.digested = data.digested;
    this.id = data.id;

    this.nextMap = new Map();
  }

  /**
   * @see {@link Candidate.id}
   */
  static generateId(data: {
    digested: number;
    gr: { id: string };
  }): CandidateID {
    return `${data.digested}#${data.gr.id}`;
  }

  /**
   * Current ***undigested*** grammar.
   * Use this to match the next node.
   */
  get current(): Grammar<NTs | ExtractKinds<LexerDataBindings>> | undefined {
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
    cs: CandidateRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
  ): Candidate<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  > | null {
    if (this.current === undefined) return null;

    // try to get from cache
    const cache = this.nextMap.get(this.current);
    if (cache !== undefined) return cache;

    // not in cache, calculate and cache
    const res = this.canDigestMore() ? cs.addNext(this) : null;
    this.nextMap.set(this.current, res);
    return res;
  }

  /**
   * For debug output.
   *
   * Format: `Candidate({ gr, digested })`
   */
  toString() {
    return `Candidate(${JSON.stringify({
      gr: this.gr.toString(),
      digested: this.digested,
    })})`;
  }

  /**
   * Format: ``{ NT: `...before # ...after` }``.
   */
  toGrammarRuleString() {
    return `{ ${this.gr.NT}: \`${this.gr.rule
      .slice(0, this.digested)
      .map((g) => g.grammarString)
      .join(" ")} # ${this.gr.rule
      .slice(this.digested)
      .map((g) => g.grammarString)
      .join(" ")}\` }`;
  }

  /**
   * This is used in State to deduplicate candidates.
   */
  // Since there will be temporary candidates, this function can't be removed.
  eq(other: {
    gr: Readonly<
      GrammarRule<
        NTs,
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >
    >;
    digested: number;
  }) {
    return (
      this === other || // same object
      (this.gr === other.gr && // grammar rules are only created when build DFA, no temp grammar rules, so we can use object equality here
        this.digested === other.digested)
    );
  }

  /**
   * Only failed if:
   * 1. Digestion not finished.
   * 2. Check follow set failed.
   * 3. Reject by conflict resolver.
   * 4. Rejecter rejected.
   */
  tryReduce(
    buffer: readonly ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >[],
    entryNTs: ReadonlySet<string>,
    ignoreEntryFollow: boolean,
    followSets: ReadonlyFollowSets<NTs, ExtractKinds<LexerDataBindings>>,
    lexer: IReadonlyTrimmedLexer<
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    selector: ASTNodeSelector<
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >,
    firstMatchSelector: ASTNodeFirstMatchSelector<
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >,
    global: Global,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<
        NTs,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>,
        Global
      > & {
        context: GrammarRuleContext<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >;
        /**
         * If `true`, the parser will commit the current state.
         */
        commit: boolean;
      }) {
    if (this.canDigestMore()) return rejectedParserOutput;

    const matched = buffer.slice(-this.gr.rule.length);
    matched.forEach((n, i) => (n.name = this.gr.rule[i].name)); // temp set name
    const rollbackNames = () => matched.forEach((n) => (n.name = n.kind)); // rollback the name

    const context = new GrammarRuleContext<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
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
    const nextTokenExists = lexer.lex({ peek: true }) !== null;
    if (nextTokenExists) {
      if (entryNTs.has(this.gr.NT) && ignoreEntryFollow) {
        // entry NT, no need to check follow set if `ignoreEntryFollow` is set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
        // TODO: if the entry NT's follow set is empty, can we ignore the next check and accept it directly?
      } else {
        // not entry NT, or not ignore entry follow(treat the entry NT as normal NT)

        let mismatch = true; // if follow mismatch, reject
        for (const [_, g] of followSets.get(this.gr.NT)!.grammars) {
          if (
            lexer.lex({
              // peek with expectation
              peek: true,
              expect: {
                kind: g.kind as ExtractKinds<LexerDataBindings>,
                text: g.text,
              },
            }) !== null
          ) {
            // found valid follow, continue
            mismatch = false;
            break;
          }
        }
        if (mismatch) {
          if (debug) {
            const info = {
              reducerRule: this.gr.toString(),
              rest: prettierLexerRest(context.lexer),
              follows: followSets
                .get(this.gr.NT)!
                .map((g) => g.grammarStringNoName),
            };
            logger.log({
              entity: "Parser",
              message: `follow mismatch for reducer rule: ${
                info.reducerRule
              }, expect: ${info.follows.join(", ")}, rest: ${info.reducerRule}`,
              info,
            });
          }
          rollbackNames();
          return rejectedParserOutput;
        }
      }
      // else, follow set matched, continue
    }

    // check conflicts
    for (const c of this.gr.conflicts) {
      // check EOF for RR conflict
      if (c.type === ConflictType.REDUCE_REDUCE) {
        // if reach end of input
        if (!nextTokenExists) {
          // if the end needs to be handled
          if (c.handleEnd) {
            // find the resolver
            const r = this.gr.resolved.find(
              // use find instead of filter here since there can only be one end handler
              (r) =>
                r.type === ConflictType.REDUCE_REDUCE &&
                r.anotherRule === c.anotherRule &&
                r.handleEnd,
            )!;
            // if not accepted, reject
            if (
              !(r.accepter instanceof Function
                ? r.accepter(context)
                : r.accepter)
            ) {
              rollbackNames();
              if (debug) {
                const info = {
                  reducerRule: this.gr.toString(),
                  anotherRule: c.anotherRule.toString(),
                };
                logger.log({
                  entity: "Parser",
                  message: `rejected by RR conflict (reach end): ${info.reducerRule} vs ${info.anotherRule}`,
                  info,
                });
              }
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
      let next: Grammar<NTs | ExtractKinds<LexerDataBindings>> | undefined =
        undefined;
      for (const g of c.next.grammars.values()) {
        next = g;
        const token = context.lexer.lex({
          // peek with expectation
          peek: true,
          expect: {
            kind: g.kind as ExtractKinds<LexerDataBindings>,
            text: g.text,
          },
        });
        if (token === null) continue; // next not match, check next next
        for (const r of c.resolvers) {
          // find related resolver by the next
          if (r.next === "*" || r.next.has(g)) {
            // resolver's next match, check accepter
            if (
              !(r.accepter instanceof Function
                ? r.accepter(context)
                : r.accepter)
            ) {
              reject = true;
            }
            // we only check the first matched resolver
            // stop checking resolvers
            break;
          }
        }
        if (reject) break;
      }
      if (reject) {
        rollbackNames();
        if (debug) {
          const info = {
            reducerRule: this.gr.toString(),
            anotherRule: c.anotherRule.toString(),
            type: c.type === ConflictType.REDUCE_REDUCE ? "RR" : "RS",
            next: next!.grammarStringNoName,
          };
          logger.log({
            entity: "Parser",
            message: `rejected by ${info.type} conflict: ${info.reducerRule} vs ${info.anotherRule}, next: ${info.next}`,
            info,
          });
        }
        return rejectedParserOutput;
      }
      // else, next not match, continue
    }

    // check rejecter
    if (this.gr.rejecter?.(context) ?? false) {
      if (debug) {
        const info = {
          reducerRule: this.gr.toString(),
        };
        logger.log({
          entity: "Parser",
          message: `rejected by rejecter: ${info.reducerRule}`,
          info,
        });
      }
      rollbackNames();
      return rejectedParserOutput;
    }

    // accept
    this.gr.callback?.(context);
    const node = new NTNode<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >({
      kind: this.gr.NT,
      children: matched,
      data: context.data,
      error: context.error,
      start: matched[0].start,
      traverser: this.gr.traverser,
      selector,
      firstMatchSelector,
      global,
    });
    node.children!.forEach((c) => (c.parent = node)); // link parent
    if (debug) {
      const info = {
        reducerRule: this.gr.toString(),
      };
      logger.log({
        entity: "Parser",
        message: `accepted: ${info.reducerRule}`,
        info,
      });
    }

    return {
      accept: true,
      buffer: context.before.concat(node),
      errors: context.error ? [node] : [],
      context,
      commit: this.gr.commit?.(context) ?? false,
    };
  }

  toJSON() {
    return {
      gr: this.gr.id,
      digested: this.digested,
      nextMap: map2serializable(
        this.nextMap,
        (g) => g.grammarString,
        (c) => (c === null ? null : c.id),
      ),
      id: this.id,
    };
  }

  static fromJSON<
    NTs extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
    Global,
  >(
    data: ReturnType<
      Candidate<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >["toJSON"]
    >,
    grs: ReadonlyGrammarRuleRepo<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >,
    repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  ) {
    const c = new Candidate<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >({
      gr: grs.get(data.gr)!,
      digested: data.digested,
      id: data.id,
    });

    // restore next map after the whole candidate repo is filled
    const restoreNextMap = (
      cs: ReadonlyCandidateRepo<
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType,
        Global
      >,
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next === null) c.nextMap.set(repo.get(key)!, null);
        else c.nextMap.set(repo.get(key)!, cs.get(next)!);
      }
    };

    return { c, restoreNextMap };
  }
}
