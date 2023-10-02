import type { Logger } from "../../../../logger";
import type { DFA } from "../../DFA";
import type {
  GrammarRule,
  Grammar,
  Conflict,
  GrammarRepo,
  ReadonlyGrammarRuleRepo,
} from "../../model";
import { GrammarSet, GrammarType, ConflictType } from "../../model";
import { TooManyEndHandlerError } from "../error";

/**
 * Return a grammar set contains NTs which might be the last input grammar.
 * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
 * These grammars will be used to check end of input.
 */
function getEndSet<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  repo: GrammarRepo<Kinds | LexerKinds>,
  entryNTs: ReadonlySet<string>,
  grs: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
) {
  const result = new GrammarSet<Kinds | LexerKinds>(); // TODO: should be a set of NTs

  // entry NTs might be the last input grammar of course
  entryNTs.forEach((nt) => result.add(repo.NT(nt as Kinds)));

  while (true) {
    let changed = false;
    grs.grammarRules.forEach((gr) => {
      if (result.has(repo.NT(gr.NT))) {
        // current NT is in result, so we need to check the last grammar of its rule
        if (gr.rule.at(-1)!.type == GrammarType.NT) {
          // last grammar is a NT, so we need to check it in result
          const last = repo.NT(gr.rule.at(-1)!.kind);
          if (!result.has(last)) {
            result.add(last);
            changed = true;
          }
        }
      }
    });
    if (!changed) break;
  }

  return result;
}

/**
 * Return conflicts that user didn't resolve.
 */
function getUserUnresolvedConflicts<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  type: ConflictType,
  reducerRule: Readonly<
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >,
  anotherRule: Readonly<
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >,
  next: GrammarSet<Kinds | LexerKinds>,
  checkHandleEnd: boolean,
  debug: boolean,
  logger: Logger,
) {
  const related = reducerRule.resolved.filter(
    // we don't need to check reducerRule here
    // since the resolved conflicts are in the reducer rule's GrammarRule.resolved
    (r) => r.type == type && r.anotherRule == anotherRule,
  );

  // collect resolved next & calculate unresolved next
  const resolvedNext = [] as {
    grammar: Grammar<Kinds | LexerKinds>;
    /**
     * If `undefined`, the accepter is a function.
     */
    accepter: boolean | undefined;
  }[];
  let resolveAll = false;
  /**
   * If `undefined`, the accepter is a function.
   */
  let acceptAll: boolean | undefined = undefined;
  related.forEach((r) => {
    if (r.next == "*") {
      resolveAll = true;
      resolvedNext.length = 0; // clear
      acceptAll = typeof r.accepter == "boolean" ? r.accepter : undefined;
    } else if (!resolveAll)
      r.next.grammars.forEach((n) =>
        resolvedNext.push({
          grammar: n,
          accepter: typeof r.accepter == "boolean" ? r.accepter : undefined,
        }),
      );
  });
  const unresolvedNext = resolveAll
    ? new GrammarSet<Kinds | LexerKinds>()
    : next.filter(
        (n) => !resolvedNext.some((rn) => n.equalWithoutName(rn.grammar)),
      );

  if (debug) {
    if (resolveAll) {
      const info = {
        reducerRule: reducerRule.toString(),
        anotherRule: anotherRule.toString(),
        next: "*",
        type: type == ConflictType.REDUCE_SHIFT ? "RS" : "RR",
        accepter: acceptAll == undefined ? "[function]" : acceptAll,
      };
      logger.log({
        entity: "Parser",
        message: `user resolved ${info.type}: ${info.reducerRule} vs ${info.anotherRule}, next: ${info.next}, accept: ${info.accepter}`,
        info,
      });
    }
    if (resolvedNext.length > 0) {
      const info = {
        reducerRule: reducerRule.toString(),
        anotherRule: anotherRule.toString(),
        type: type == ConflictType.REDUCE_SHIFT ? "RS" : "RR",
        next: resolvedNext.map((g) => ({
          grammar: g.grammar.toString(),
          accepter: g.accepter == undefined ? "[function]" : g.accepter,
        })),
      };
      logger.log({
        entity: "Parser",
        message: `user resolved ${info.type}: ${info.reducerRule} vs ${
          info.anotherRule
        }, next: ${info.next
          .map((n) => `${n.grammar}(${n.accepter})`)
          .join(", ")}`,
        info,
      });
    }
    if (unresolvedNext.grammars.size > 0) {
      const info = {
        reducerRule: reducerRule.toString(),
        anotherRule: anotherRule.toString(),
        type: type == ConflictType.REDUCE_SHIFT ? "RS" : "RR",
        next: unresolvedNext.map((g) => g.toString()),
      };
      logger.log({
        entity: "Parser",
        message: `unresolved ${info.type}: ${info.reducerRule} vs ${
          info.anotherRule
        }, next: ${info.next.join(", ")}'`,
        info,
      });
    }
  }

  // check end
  const endHandlers = related.filter((r) => r.handleEnd);
  if (endHandlers.length > 1) {
    // only one end handler is allowed
    throw new TooManyEndHandlerError(reducerRule);
  }
  let unresolvedEnd = checkHandleEnd;
  if (checkHandleEnd) {
    if (endHandlers.length == 1) {
      unresolvedEnd = !endHandlers[0].handleEnd;
    } else {
      // user didn't handle end of input
      unresolvedEnd = true;
    }
    if (debug) {
      if (unresolvedEnd) {
        const info = {
          reducerRule: reducerRule.toString(),
          anotherRule: anotherRule.toString(),
        };
        logger.log({
          entity: "Parser",
          message: `unresolved RR (end of input): ${info.reducerRule} vs ${info.anotherRule}`,
          info,
        });
      }
    }
  }

  return {
    next: unresolvedNext,
    /** If true, means user didn't handle end of input. */
    end: unresolvedEnd,
  };
}

/**
 * Calculate all conflicts for every grammar rule. This function will try to auto resolve conflicts if possible.
 * Conflicts that can't be auto resolved will be stored in `GrammarRule.conflicts` in `grs`.
 */
export function appendConflicts<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  repo: GrammarRepo<Kinds | LexerKinds>,
  entryNTs: ReadonlySet<string>,
  grs: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
  dfa: DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  debug: boolean,
  logger: Logger,
) {
  const endSet = getEndSet(repo, entryNTs, grs);

  // calculate conflicts by DFA states
  dfa.states.states.forEach((state) => {
    // first, check if there is any reduce-able candidate in the current state
    const reducers = state.candidates.filter((c) => !c.canDigestMore());

    // all reduce-able candidates may have RR conflicts with each other
    reducers.forEach((reducer, i) => {
      reducers.forEach((another, j) => {
        // prevent duplicate check & self check
        if (i >= j) return;

        // if there is no overlap between reducer's follow and another's follow
        // then there is no RR conflict for next, but maybe still has RR conflict when handle end of input
        const followOverlap = dfa.followSets
          .get(reducer.gr.NT)!
          .overlap(dfa.followSets.get(another.gr.NT)!);

        // if reducer's NT and another's NT are both in end set, then we need to handle end of input
        const handleEnd =
          endSet.has(repo.NT(reducer.gr.NT)) &&
          endSet.has(repo.NT(another.gr.NT));

        if (debug) {
          const info = {
            reducerRule: reducer.gr.toString(),
            anotherRule: another.gr.toString(),
          };
          if (followOverlap.grammars.size == 0) {
            logger.log({
              entity: "Parser",
              message: `auto resolve RR (no follow overlap): ${info.reducerRule} vs ${info.anotherRule}`,
              info,
            });
          }
          if (!handleEnd) {
            logger.log({
              entity: "Parser",
              message: `auto resolve RR (no handle end): ${info.reducerRule} vs ${info.anotherRule}`,
              info,
            });
          }
        }

        if (followOverlap.grammars.size != 0 || handleEnd) {
          // TODO: deduplicate?
          reducer.gr.conflicts.push({
            type: ConflictType.REDUCE_REDUCE,
            anotherRule: another.gr,
            next: followOverlap,
            handleEnd,
            resolvers: [],
          });
          another.gr.conflicts.push({
            type: ConflictType.REDUCE_REDUCE,
            anotherRule: reducer.gr,
            next: followOverlap,
            handleEnd,
            resolvers: [],
          });
        }
      });
    });

    // all reduce-able candidates may have RS conflicts with non-reduce-able candidates
    const anothers = state.candidates.filter(
      (c) =>
        c.canDigestMore() &&
        // if digested == 0, this candidate has indirect RS conflict with reducer, skip it.
        // we only want direct RS conflict
        c.digested != 0,
    );
    reducers.forEach((reducer) => {
      anothers.forEach((another) => {
        // if there is no overlap between reducer's NT's follow and another's next
        // then there is no RS conflict
        if (another.current!.type == GrammarType.T) {
          if (!dfa.followSets.get(reducer.gr.NT)!.has(another.current!)) {
            // no overlap, no RS conflict
            if (debug) {
              const info = {
                reducerRule: reducer.gr.toString(),
                anotherRule: another.gr.toString(),
              };
              logger.log({
                entity: "Parser",
                message: `auto resolve RS (no follow overlap): ${reducer.gr.toString()} vs ${another.gr.toString()}`,
                info,
              });
            }
          } else {
            // overlap, RS conflict
            // TODO: deduplicate?
            reducer.gr.conflicts.push({
              type: ConflictType.REDUCE_SHIFT,
              anotherRule: another.gr,
              handleEnd: false,
              next: new GrammarSet([another.current!]),
              overlapped: another.digested,
              resolvers: [],
            });
          }
        } else {
          // another's next is a NT, check if reducer's NT's follow has some grammar that is also in another's next's first
          const overlap = dfa.followSets
            .get(reducer.gr.NT)!
            .overlap(dfa.firstSets.get(another.current!.kind as Kinds)!);

          if (overlap.grammars.size > 0) {
            // overlap, RS conflict
            // TODO: deduplicate?
            reducer.gr.conflicts.push({
              type: ConflictType.REDUCE_SHIFT,
              anotherRule: another.gr,
              handleEnd: false,
              next: overlap,
              overlapped: another.digested,
              resolvers: [],
            });
          } else {
            if (debug) {
              const info = {
                reducerRule: reducer.gr.toString(),
                anotherRule: another.gr.toString(),
              };
              if (overlap.grammars.size == 0) {
                logger.log({
                  entity: "Parser",
                  message: `auto resolve RS (no follow overlap): ${info.reducerRule} vs ${info.anotherRule}`,
                  info,
                });
              }
            }
          }
        }
      });
    });
  });
}

/**
 * Return conflicts that user didn't resolve and can't be automatically resolved.
 * Returned conflicts are newly constructed, not the same as `GrammarRule.conflicts`,
 * since the user may resolve part of the conflicts.
 */
export function getUnresolvedConflicts<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  grs: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
  debug: boolean,
  logger: Logger,
) {
  const result = new Map<
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
    Conflict<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
  >();

  grs.grammarRules.forEach((reducerRule) => {
    reducerRule.conflicts.forEach((c) => {
      if (c.type == ConflictType.REDUCE_SHIFT) {
        const res = getUserUnresolvedConflicts(
          ConflictType.REDUCE_SHIFT,
          reducerRule,
          c.anotherRule,
          c.next,
          false, // for a RS conflict, we don't need to handle end of input
          debug,
          logger,
        );

        if (res.next.grammars.size > 0) {
          const conflict: Conflict<
            ASTData,
            ErrorType,
            Kinds,
            LexerKinds,
            LexerError
          > = {
            type: ConflictType.REDUCE_SHIFT,
            anotherRule: c.anotherRule,
            handleEnd: false,
            next: res.next,
            overlapped: c.overlapped,
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(conflict);
          else result.set(reducerRule, [conflict]);
        }
      } else {
        // RR conflict
        const res = getUserUnresolvedConflicts(
          ConflictType.REDUCE_REDUCE,
          reducerRule,
          c.anotherRule,
          c.next,
          c.handleEnd,
          debug,
          logger,
        );
        if (res.next.grammars.size > 0 || res.end) {
          const conflict: Conflict<
            ASTData,
            ErrorType,
            Kinds,
            LexerKinds,
            LexerError
          > = {
            type: ConflictType.REDUCE_REDUCE,
            anotherRule: c.anotherRule,
            handleEnd: res.end,
            next: res.next,
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(conflict);
          else result.set(reducerRule, [conflict]);
        }
      }
    });
  });

  return result;
}
