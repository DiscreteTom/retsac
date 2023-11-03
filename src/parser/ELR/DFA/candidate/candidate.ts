import type { CandidateRepo, ReadonlyCandidateRepo } from "./candidate-repo";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  IReadonlyLexer,
  Token,
} from "../../../../lexer";
import type { Logger } from "../../../../logger";
import { ASTNode } from "../../../ast";
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
import {
  cascadeASTNodeSelectorFactory,
  cascadeASTNodeFirstMatchSelectorFactory,
  map2serializable,
  prettierLexerRest,
} from "../utils";

/** Candidate for ELR parsers. */
export class Candidate<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  readonly gr: Readonly<
    GrammarRule<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
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
    Grammar<Kinds | ExtractKinds<LexerDataBindings>>,
    Candidate<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    > | null // don't use `undefined` here because `Map.get` return `undefined` when key not found
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
      Candidate<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
      "gr" | "digested" | "strWithGrammarName"
    > &
      Partial<
        Pick<
          Candidate<
            Kinds,
            ASTData,
            ErrorType,
            LexerDataBindings,
            LexerActionState,
            LexerErrorType
          >,
          "str"
        >
      >,
  ) {
    this.gr = data.gr;
    this.digested = data.digested;
    this.nextMap = new Map();

    this.strWithGrammarName = data.strWithGrammarName;
    this.str = this.strWithGrammarName;
  }

  /**
   * Current ***undigested*** grammar.
   * Use this to match the next node.
   */
  get current(): Grammar<Kinds | ExtractKinds<LexerDataBindings>> | undefined {
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
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
  ): Candidate<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
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
   */
  toString() {
    return this.str;
  }

  /**
   * Return `NT := ...before # ...after`.
   * This is unique for each candidate.
   */
  static getStrWithGrammarName<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    data: Pick<
      Candidate<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
      "gr" | "digested"
    >,
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
    gr: Readonly<
      GrammarRule<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
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
      Kinds,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>
    >[],
    entryNTs: ReadonlySet<string>,
    ignoreEntryFollow: boolean,
    followSets: ReadonlyFollowSets<Kinds, ExtractKinds<LexerDataBindings>>,
    lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerErrorType>,
    cascadeQueryPrefix: string | undefined,
    debug: boolean,
    logger: Logger,
  ):
    | RejectedParserOutput
    | (AcceptedParserOutput<
        Kinds,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>
      > & {
        context: GrammarRuleContext<
          Kinds,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType
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

    const selector = cascadeASTNodeSelectorFactory<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerErrorType
    >(cascadeQueryPrefix);
    const firstMatchSelector = cascadeASTNodeFirstMatchSelectorFactory<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerErrorType
    >(cascadeQueryPrefix);
    const context = new GrammarRuleContext<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
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
    const nextTokenExists = lexer.lex({ peek: true }) !== null; // TODO: ensure lexer is already trimmed to optimize perf? new type: IReadonlyTrimmedLexer?
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
                .map((g) => g.grammarStrWithoutName.value),
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
      let next: Grammar<Kinds | ExtractKinds<LexerDataBindings>> | undefined =
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
            next: next!.grammarStrWithoutName.value,
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
    const node = new ASTNode<
      Kinds,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>
    >({
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

  toSerializable(
    grs: ReadonlyGrammarRuleRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    cs: ReadonlyCandidateRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    return {
      gr: grs.getKey(this.gr),
      digested: this.digested,
      nextMap: map2serializable(
        this.nextMap,
        (g) => repo.getKey(g),
        (c) => (c === null ? null : cs.getKey(c)),
      ),
      str: this.str,
      strWithGrammarName: this.strWithGrammarName,
    };
  }

  static fromJSON<
    Kinds extends string,
    ASTData,
    ErrorType,
    LexerDataBindings extends GeneralTokenDataBinding,
    LexerActionState,
    LexerErrorType,
  >(
    data: ReturnType<
      Candidate<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >["toSerializable"]
    >,
    grs: ReadonlyGrammarRuleRepo<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >,
    repo: GrammarRepo<Kinds, ExtractKinds<LexerDataBindings>>,
  ) {
    const c = new Candidate<
      Kinds,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType
    >({
      gr: grs.getByString(data.gr)!,
      digested: data.digested,
      strWithGrammarName: data.strWithGrammarName,
      str: data.str,
    });

    // restore next map after the whole candidate repo is filled
    const restoreNextMap = (
      cs: ReadonlyCandidateRepo<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >,
    ) => {
      for (const key in data.nextMap) {
        const next = data.nextMap[key];
        if (next === null) c.nextMap.set(repo.getByString(key)!, null);
        else c.nextMap.set(repo.getByString(key)!, cs.getByString(next)!);
      }
    };

    return { c, restoreNextMap };
  }
}
