import { DFA } from "../../DFA";
import {
  GrammarRule,
  GrammarSet,
  Grammar,
  GrammarType,
  Conflict,
  ConflictType,
  ResolvedConflict,
  GrammarRepo,
  GrammarRuleRepo,
} from "../../model";
import { LR_BuilderError } from "../error";

/**
 * Return a grammar set contains NTs which might be the last input grammar.
 * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
 * These grammars will be used to check end of input.
 */
function getEndSet<T>(
  repo: GrammarRepo,
  entryNTs: ReadonlySet<string>,
  grs: GrammarRuleRepo<T>
) {
  const result = new GrammarSet();

  // entry NTs might be the last input grammar of course
  entryNTs.forEach((nt) => result.add(repo.NT(nt)));

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
function getUserUnresolvedConflicts<T>(
  type: ConflictType,
  reducerRule: Readonly<GrammarRule<T>>,
  anotherRule: Readonly<GrammarRule<T>>,
  next: readonly Grammar[],
  checkHandleEnd: boolean,
  debug: boolean
) {
  const related = reducerRule.resolved.filter(
    // we don't need to check reducerRule here
    // since the resolved conflicts are in the reducer rule's GrammarRule.resolved
    (r) => r.type == type && r.anotherRule == anotherRule
  );

  // collect resolved next & calculate unresolved next
  const resolvedNext = [] as Grammar[];
  let resolveAll = false;
  related.forEach((r) => {
    if (r.next == "*") {
      resolveAll = true;
      resolvedNext.length = 0; // clear
    } else if (!resolveAll) r.next.forEach((n) => resolvedNext.push(n));
  });
  const unresolvedNext = resolveAll
    ? []
    : next.filter((n) => !resolvedNext.some((rn) => n.eq(rn)));

  if (debug) {
    if (resolveAll)
      console.log(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toStringWithGrammarName()} | ${anotherRule.toStringWithGrammarName()} next: *`
      );
    if (resolvedNext.length > 0)
      console.log(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toStringWithGrammarName()} | ${anotherRule.toStringWithGrammarName()} next: ${resolvedNext}`
      );
    if (unresolvedNext.length > 0)
      console.log(
        `[unresolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toStringWithGrammarName()} | ${anotherRule.toStringWithGrammarName()} next: ${unresolvedNext}`
      );
  }

  // check end
  const endHandlers = related.filter((r) => r.handleEnd);
  if (endHandlers.length > 1) {
    // TODO: allow multi end handler?
    throw LR_BuilderError.tooManyEndHandler(reducerRule);
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
        console.log(
          `[unresolved RR]: ${reducerRule.toStringWithGrammarName()} | ${anotherRule.toStringWithGrammarName()} end of input`
        );
      if (unresolvedNext.length > 0)
        console.log(
          `[user resolved RR]: ${reducerRule.toStringWithGrammarName()} | ${anotherRule.toStringWithGrammarName()} end of input`
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
export function getConflicts<T>(
  repo: GrammarRepo,
  entryNTs: ReadonlySet<string>,
  grs: GrammarRuleRepo<T>,
  dfa: DFA<T>,
  debug = false
) {
  const firstSets = dfa.firstSets;
  const followSets = dfa.followSets;
  const endSet = getEndSet(repo, entryNTs, grs);
  const states = dfa.getAllStates();

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
          if (overlap.length == 0) {
            // no overlap, conflicts can be auto resolved
            if (debug)
              // TODO: use logger & callback
              console.log(
                `[auto resolve RS (no follow overlap)]: ${reducerRule.toStringWithGrammarName()} | ${c.shifterRule.toStringWithGrammarName()}`
              );
            return;
          }
          // check states
          if (
            !states.some(
              (s) =>
                s.contains(reducerRule, reducerRule.rule.length) &&
                s.contains(anotherRule, c.overlapped)
            )
          ) {
            // no state contains both rules with the digestion condition, conflicts can be auto resolved
            if (debug)
              // TODO: use logger & callback
              console.log(
                `[auto resolve RS (DFA state)]: ${reducerRule.toStringWithGrammarName()} | ${c.shifterRule.toStringWithGrammarName()}`
              );
            return;
          }

          // auto resolve failed
          const conflict: Conflict<T> = {
            type: ConflictType.REDUCE_SHIFT,
            anotherRule,
            handleEnd: false,
            next: overlap,
            overlapped: c.overlapped,
          };
          reducerRule.conflicts.push(conflict);
        } else if (E.type == GrammarType.T) {
          // E is a T, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.overlapped)
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                // TODO: use logger & callback
                console.log(
                  `[auto resolve RS (DFA state)]: ${reducerRule.toStringWithGrammarName()} | ${c.shifterRule.toStringWithGrammarName()}`
                );
              return;
            }

            // auto resolve failed
            const conflict: Conflict<T> = {
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: [E],
              overlapped: c.overlapped,
            };
            reducerRule.conflicts.push(conflict);
          }
        } else {
          // E is a literal, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.overlapped)
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                // TODO: use logger & callback
                console.log(
                  `[auto resolve RS (DFA state)]: ${reducerRule.toStringWithGrammarName()} | ${c.shifterRule.toStringWithGrammarName()}`
                );
              return;
            }

            // auto resolve failed
            const conflict: Conflict<T> = {
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: [E],
              overlapped: c.overlapped,
            };
            reducerRule.conflicts.push(conflict);
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
        if (overlap.length == 0) {
          // no overlap, all conflicts can be auto resolved
          if (debug)
            // TODO: use logger & callback
            console.log(
              `[auto resolve RR (no follow overlap)]: ${reducerRule} ${anotherRule}`
            );
          return;
        }
        // check states
        if (
          !states.some(
            (s) =>
              s.contains(reducerRule, reducerRule.rule.length) &&
              s.contains(anotherRule, anotherRule.rule.length)
          )
        ) {
          // no state contains both rules with the digestion condition, conflicts can be auto resolved
          if (debug)
            // TODO: use logger & callback
            console.log(
              `[auto resolve RR (DFA state)]: ${reducerRule} ${anotherRule}`
            );
          return;
        }

        // auto resolve failed
        const c: Conflict<T> = {
          type: ConflictType.REDUCE_REDUCE,
          anotherRule,
          next: overlap,
          // for a RR conflict, we need to handle end of input if both's NT in end sets
          handleEnd:
            endSet.has(repo.NT(reducerRule.NT)) &&
            endSet.has(repo.NT(anotherRule.NT)),
        };
        reducerRule.conflicts.push(c);
      }
    });
  });
}

/**
 * Return conflicts that user didn't resolve and can't be automatically resolved.
 * Returned conflicts are newly constructed, not the same as `GrammarRule.conflicts`,
 * since the user may resolve part of the conflicts.
 */
export function getUnresolvedConflicts<T>(
  grs: GrammarRuleRepo<T>,
  debug: boolean
) {
  const result = new Map<GrammarRule<T>, Conflict<T>[]>();

  grs.grammarRules.forEach((reducerRule) => {
    reducerRule.conflicts.forEach((c) => {
      if (c.type == ConflictType.REDUCE_SHIFT) {
        const res = getUserUnresolvedConflicts(
          ConflictType.REDUCE_SHIFT,
          reducerRule,
          c.anotherRule,
          c.next,
          false, // for a RS conflict, we don't need to handle end of input
          debug
        );

        if (res.next.length > 0) {
          const conflict: Conflict<T> = {
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
          debug
        );
        if (res.next.length > 0 || res.end) {
          const conflict: Conflict<T> = {
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
