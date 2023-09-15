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
>(
  repo: GrammarRepo<Kinds | LexerKinds>,
  entryNTs: ReadonlySet<string>,
  grs: ReadonlyGrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
) {
  const result = new GrammarSet<Kinds | LexerKinds>();

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
>(
  type: ConflictType,
  reducerRule: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>,
  anotherRule: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>,
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
  const resolvedNext = [] as Grammar<Kinds | LexerKinds>[];
  let resolveAll = false;
  related.forEach((r) => {
    if (r.next == "*") {
      resolveAll = true;
      resolvedNext.length = 0; // clear
    } else if (!resolveAll)
      r.next.grammars.forEach((n) => resolvedNext.push(n));
  });
  const unresolvedNext = resolveAll
    ? new GrammarSet<Kinds | LexerKinds>()
    : next.filter((n) => !resolvedNext.some((rn) => n.equalWithoutName(rn)));

  if (debug) {
    if (resolveAll)
      logger(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule} | ${anotherRule} next: *`,
      );
    if (resolvedNext.length > 0)
      logger(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule} | ${anotherRule} next: ${resolvedNext
          .map((g) => g.grammarStrWithoutName.value)
          .join(" ")}`,
      );
    if (unresolvedNext.grammars.size > 0)
      logger(
        `[unresolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule} | ${anotherRule} next: ${unresolvedNext
          .map((g) => g.grammarStrWithoutName.value)
          .join(" ")}`,
      );
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
      if (unresolvedEnd)
        logger(`[unresolved RR]: ${reducerRule} | ${anotherRule} end of input`);
      if (unresolvedNext.grammars.size > 0)
        logger(
          `[user resolved RR]: ${reducerRule} | ${anotherRule} end of input`,
        );
    }
  }

  return {
    next: unresolvedNext,
    /** If true, means user didn't handle end of input. */
    end: unresolvedEnd,
  };
}

/**
 * Get all conflicts in a grammar rules. This function will try to auto resolve conflicts if possible.
 * Conflicts that can't be auto resolved will be stored in `GrammarRule.conflicts` in `grs`.
 */
export function getConflicts<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  repo: GrammarRepo<Kinds | LexerKinds>,
  entryNTs: ReadonlySet<string>,
  grs: ReadonlyGrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  dfa: DFA<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  debug: boolean,
  logger: Logger,
) {
  const firstSets = dfa.firstSets;
  const followSets = dfa.followSets;
  const endSet = getEndSet(repo, entryNTs, grs);
  const states = dfa.states;

  // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
  // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
  // the following code will check every grammar rule pair, another way is to check every DFA state
  // but different DFA states may contain same grammar rules which will cause duplicate check
  grs.grammarRules.forEach((reducerRule) => {
    grs.grammarRules.forEach((anotherRule) => {
      const conflicts = reducerRule.checkRSConflict(anotherRule);
      conflicts.forEach((c) => {
        // try to auto resolve conflicts if possible
        // e.g. for a reduce-shift conflict: `A <= B C` and `D <= C E`
        // if A's follow overlap with E's first, then the conflict can't be auto resolved by LR1 peeking
        const A = reducerRule.NT;
        const E = c.shifterRule.rule[c.overlapped];
        const EFirst = firstSets.get(E.kind)!;
        const AFollow = followSets.get(A)!;
        if (E.type == GrammarType.NT) {
          // E is a NT, check if A's follow has some grammar that is also in E's first
          const overlap = AFollow.overlap(EFirst);
          if (overlap.grammars.size == 0) {
            // no overlap, conflicts can be auto resolved
            if (debug)
              logger(
                `[auto resolve RS (no follow overlap)]: ${reducerRule} | ${c.shifterRule}`,
              );
            return;
          }
          // check states
          if (
            !states.some(
              (s) =>
                s.contains(reducerRule, reducerRule.rule.length) &&
                s.contains(anotherRule, c.overlapped),
            )
          ) {
            // no state contains both rules with the digestion condition, conflicts can be auto resolved
            if (debug)
              logger(
                `[auto resolve RS (DFA state)]: ${reducerRule} | ${c.shifterRule}`,
              );
            return;
          }

          // auto resolve failed
          reducerRule.conflicts.push({
            type: ConflictType.REDUCE_SHIFT,
            anotherRule,
            handleEnd: false,
            next: overlap,
            overlapped: c.overlapped,
            resolvers: [],
          });
        } else if (E.type == GrammarType.T) {
          // E is a T, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.overlapped),
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                logger(
                  `[auto resolve RS (DFA state)]: ${reducerRule} | ${c.shifterRule}`,
                );
              return;
            }

            // auto resolve failed
            reducerRule.conflicts.push({
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: new GrammarSet([E]),
              overlapped: c.overlapped,
              resolvers: [],
            });
          }
        } else {
          // E is a literal, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.overlapped),
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                logger(
                  `[auto resolve RS (DFA state)]: ${reducerRule} | ${c.shifterRule}`,
                );
              return;
            }

            // auto resolve failed
            reducerRule.conflicts.push({
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: new GrammarSet([E]),
              overlapped: c.overlapped,
              resolvers: [],
            });
          }
        }
      });
    });
  });

  // if the tail of a grammar rule is the same as another grammar rule, it's a reduce-reduce conflict
  // e.g. `A B C | B C` is a reduce-reduce conflict
  grs.grammarRules.forEach((reducerRule) => {
    grs.grammarRules.forEach((anotherRule) => {
      if (anotherRule == reducerRule) return; // skip the same rule
      if (reducerRule.checkRRConflict(anotherRule)) {
        // try to auto resolve conflicts if possible
        // e.g. for a reduce-reduce conflict: `A <= B` and `C <= D B`
        // if A's follow has some grammar that is also in C's follow, the conflict can't be resolved by LR1 peeking
        const A = reducerRule.NT;
        const C = anotherRule.NT;
        const overlap = followSets.get(A)!.overlap(followSets.get(C)!);
        if (overlap.grammars.size == 0) {
          // no overlap, all conflicts can be auto resolved
          if (debug)
            logger(
              `[auto resolve RR (no follow overlap)]: ${reducerRule} ${anotherRule}`,
            );
          return;
        }
        // check states
        if (
          !states.some(
            (s) =>
              s.contains(reducerRule, reducerRule.rule.length) &&
              s.contains(anotherRule, anotherRule.rule.length),
          )
        ) {
          // no state contains both rules with the digestion condition, conflicts can be auto resolved
          if (debug)
            logger(
              `[auto resolve RR (DFA state)]: ${reducerRule} ${anotherRule}`,
            );
          return;
        }

        // auto resolve failed
        reducerRule.conflicts.push({
          type: ConflictType.REDUCE_REDUCE,
          anotherRule,
          next: overlap,
          // for a RR conflict, we need to handle end of input if both's NT in end sets
          handleEnd:
            endSet.has(repo.NT(reducerRule.NT)) &&
            endSet.has(repo.NT(anotherRule.NT)),
          resolvers: [],
        });
      }
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
>(
  grs: ReadonlyGrammarRuleRepo<ASTData, ErrorType, Kinds, LexerKinds>,
  debug: boolean,
  logger: Logger,
) {
  const result = new Map<
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>,
    Conflict<ASTData, ErrorType, Kinds, LexerKinds>[]
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
          const conflict: Conflict<ASTData, ErrorType, Kinds, LexerKinds> = {
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
          const conflict: Conflict<ASTData, ErrorType, Kinds, LexerKinds> = {
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
