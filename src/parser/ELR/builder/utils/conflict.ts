import { DFA } from "../../DFA";
import {
  GrammarRule,
  GrammarSet,
  Grammar,
  GrammarType,
  Conflict,
  ConflictType,
} from "../../model";
import { LR_BuilderError } from "../error";
import { ResolvedConflict } from "../model";

/**
 * Return a grammar set contains NTs which might be the last input grammar.
 * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
 * These grammars will be used to check end of input.
 */
function getEndSet<T>(
  entryNTs: ReadonlySet<string>,
  grs: readonly GrammarRule<T>[]
) {
  const result = new GrammarSet();

  // entry NTs might be the last input grammar of course
  entryNTs.forEach((nt) => result.add(Grammar.NT(nt)));

  while (true) {
    let changed = false;
    grs.forEach((gr) => {
      if (result.has(Grammar.NT(gr.NT))) {
        // current NT is in result, so we need to check the last grammar of its rule
        if (gr.rule.at(-1)!.type == GrammarType.NT) {
          // last grammar is a NT, so we need to check it in result
          const last = Grammar.NT(gr.rule.at(-1)!.kind);
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

/** Return conflicts that user didn't resolve. */
function getUserUnresolvedConflicts<T>(
  resolved: readonly ResolvedConflict<T>[],
  type: ConflictType,
  reducerRule: Readonly<GrammarRule<T>>,
  anotherRule: Readonly<GrammarRule<T>>,
  next: readonly Grammar[],
  checkHandleEnd: boolean,
  debug: boolean
) {
  const related = resolved.filter(
    (r) =>
      r.type == type &&
      r.reducerRule == reducerRule &&
      r.anotherRule == anotherRule
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
        }]: ${reducerRule.toString()} | ${anotherRule.toString()} next: *`
      );
    if (resolvedNext.length > 0)
      console.log(
        `[user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${resolvedNext}`
      );
    if (unresolvedNext.length > 0)
      console.log(
        `[unresolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }]: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${unresolvedNext}`
      );
  }

  // check end
  const endHandlers = related.filter((r) => r.handleEnd);
  if (endHandlers.length > 1) {
    throw LR_BuilderError.tooManyEndHandler(endHandlers[0].reducerRule);
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
          `[unresolved RR]: ${reducerRule.toString()} | ${anotherRule.toString()} end of input`
        );
      if (unresolvedNext.length > 0)
        console.log(
          `[user resolved RR]: ${reducerRule.toString()} | ${anotherRule.toString()} end of input`
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
 */
export function getConflicts<T>(
  entryNTs: ReadonlySet<string>,
  grs: readonly GrammarRule<T>[],
  dfa: DFA<T>,
  debug = false
) {
  const firstSets = dfa.getFirstSets();
  const followSets = dfa.getFollowSets();
  const endSet = getEndSet(entryNTs, grs);
  const states = dfa.getAllStates();

  const result = new Map<GrammarRule<T>, Conflict<T>[]>();

  // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
  // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
  // the following code will check every grammar rule pair, another way is to check every DFA state
  // but different DFA states may contain same grammar rules which will cause duplicate check
  for (let i = 0; i < grs.length; i++) {
    for (let j = 0; j < grs.length; j++) {
      const reducerRule = grs[i];
      const anotherRule = grs[j];
      const conflicts = reducerRule.checkRSConflict(anotherRule);
      conflicts.forEach((c) => {
        // try to auto resolve conflicts if possible
        // e.g. for a reduce-shift conflict: `A <= B C` and `D <= C E`
        // if A's follow overlap with E's first, then the conflict can't be auto resolved by LR1 peeking
        const A = c.reducerRule.NT;
        const E = c.shifterRule.rule[c.length];
        const EFirst = firstSets.get(E.kind)!;
        const AFollow = followSets.get(A)!;
        if (E.type == GrammarType.NT) {
          // E is a NT, check if A's follow has some grammar that is also in E's first
          const overlap = AFollow.overlap(EFirst);
          if (overlap.length == 0) {
            // no overlap, conflicts can be auto resolved
            if (debug)
              console.log(
                `[auto resolve RS (no follow overlap)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
              );
            return;
          }
          // check states
          if (
            !states.some(
              (s) =>
                s.contains(reducerRule, reducerRule.rule.length) &&
                s.contains(anotherRule, c.length)
            )
          ) {
            // no state contains both rules with the digestion condition, conflicts can be auto resolved
            if (debug)
              console.log(
                `[auto resolve RS (DFA state)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
              );
            return;
          }

          // auto resolve failed
          const conflict: Conflict<T> = {
            type: ConflictType.REDUCE_SHIFT,
            anotherRule,
            handleEnd: false,
            next: overlap,
            overlapped: c.length,
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(conflict);
          else result.set(reducerRule, [conflict]);
        } else if (E.type == GrammarType.T) {
          // E is a T, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.length)
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                console.log(
                  `[auto resolve RS (DFA state)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
                );
              return;
            }

            // auto resolve failed
            const conflict: Conflict<T> = {
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: [Grammar.T(E.kind)],
              overlapped: c.length,
            };
            if (result.has(reducerRule))
              result.get(reducerRule)!.push(conflict);
            else result.set(reducerRule, [conflict]);
          }
        } else {
          // E is a literal, check if A's follow has E
          if (AFollow.has(E)) {
            // check states
            if (
              !states.some(
                (s) =>
                  s.contains(reducerRule, reducerRule.rule.length) &&
                  s.contains(anotherRule, c.length)
              )
            ) {
              // no state contains both rules with the digestion condition, conflicts can be auto resolved
              if (debug)
                console.log(
                  `[auto resolve RS (DFA state)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
                );
              return;
            }

            // auto resolve failed
            const conflict: Conflict<T> = {
              type: ConflictType.REDUCE_SHIFT,
              anotherRule,
              handleEnd: false,
              next: [Grammar.Literal(E.kind, E.kind)], // TODO: change this
              overlapped: c.length,
            };
            if (result.has(reducerRule))
              result.get(reducerRule)!.push(conflict);
            else result.set(reducerRule, [conflict]);
          }
        }
      });
    }
  }

  // if the tail of a grammar rule is the same as another grammar rule, it's a reduce-reduce conflict
  // e.g. `A B C | B C` is a reduce-reduce conflict
  for (let i = 0; i < grs.length; i++) {
    for (let j = 0; j < grs.length; j++) {
      if (i == j) continue; // skip the same rule
      const reducerRule = grs[i];
      const anotherRule = grs[j];
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
            console.log(
              `[auto resolve RR (no follow overlap)]: ${reducerRule} ${anotherRule}`
            );
          continue;
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
            console.log(
              `[auto resolve RR (DFA state)]: ${reducerRule} ${anotherRule}`
            );
          continue;
        }

        // auto resolve failed
        const c: Conflict<T> = {
          type: ConflictType.REDUCE_REDUCE,
          anotherRule,
          next: overlap,
          // for a RR conflict, we need to handle end of input if both's NT in end sets
          handleEnd:
            endSet.has(Grammar.NT(reducerRule.NT)) &&
            endSet.has(Grammar.NT(anotherRule.NT)),
        };
        if (result.has(reducerRule)) result.get(reducerRule)!.push(c);
        else result.set(reducerRule, [c]);
      }
    }
  }

  return result;
}

/**
 * Return conflicts that user didn't resolve and can't be automatically resolved.
 */
export function getUnresolvedConflicts<T>(
  conflicts: ReadonlyMap<GrammarRule<T>, Conflict<T>[]>,
  resolved: readonly ResolvedConflict<T>[],
  debug = false
) {
  const result = new Map<GrammarRule<T>, Conflict<T>[]>();

  conflicts.forEach((cs, reducerRule) => {
    cs.forEach((c) => {
      if (c.type == ConflictType.REDUCE_SHIFT) {
        const res = getUserUnresolvedConflicts(
          resolved,
          ConflictType.REDUCE_SHIFT,
          reducerRule,
          c.anotherRule,
          c.next as Grammar[],
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
          resolved,
          ConflictType.REDUCE_REDUCE,
          reducerRule,
          c.anotherRule,
          c.next as Grammar[],
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
