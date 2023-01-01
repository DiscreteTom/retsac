import { ILexer } from "../../../lexer/model";
import { DFA } from "../DFA";
import { ParserError, ParserErrorType } from "../error";
import { Grammar, GrammarRule, GrammarSet, GrammarType } from "../model";
import { TempConflict, ConflictType, Conflict } from "./model";

/**
 * Return a grammar set contains NTs which might be the last input grammar.
 * E.g. entry NT is A, and we have `A: B C | D E`, then the result will be `{A, C, E}`.
 * These grammars will be used to check end of input.
 */
function getEndSet<T>(entryNTs: Set<string>, grs: GrammarRule<T>[]) {
  const result = new GrammarSet();

  // entry NTs might be the last input grammar of course
  entryNTs.forEach((nt) =>
    result.add(new Grammar({ content: nt, type: GrammarType.NT }))
  );

  while (true) {
    let changed = false;
    grs.forEach((gr) => {
      if (result.has(new Grammar({ content: gr.NT, type: GrammarType.NT }))) {
        // current NT is in result, so we need to check the last grammar of its rule
        if (gr.rule.at(-1)!.type == GrammarType.NT) {
          // last grammar is a NT, so we need to check it in result
          const last = new Grammar({
            content: gr.rule.at(-1)!.content,
            type: GrammarType.NT,
          });
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
function getUnresolvedConflicts<T>(
  resolved: TempConflict<T>[],
  NTs: Set<string>,
  type: ConflictType,
  reducerRule: GrammarRule<T>,
  anotherRule: GrammarRule<T>,
  next: Grammar[],
  checkHandleEnd: boolean,
  debug: boolean
) {
  const related = resolved.filter(
    (r) =>
      r.type == type &&
      r.reducerRule.weakEq(reducerRule) &&
      r.anotherRule.weakEq(anotherRule)
  );

  // collect resolve next & calculate unresolved next
  const resolvedNext = [] as Grammar[];
  related.forEach((r) =>
    r.next.forEach((n) => resolvedNext.push(n.toGrammar(NTs.has(n.content))))
  );
  const unresolvedNext = next.filter(
    (n) => !resolvedNext.some((rn) => n.eq(rn))
  );

  if (debug) {
    if (resolvedNext.length > 0)
      console.log(
        `user resolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${resolvedNext}`
      );
    if (unresolvedNext.length > 0)
      console.log(
        `unresolved ${
          type == ConflictType.REDUCE_SHIFT ? "RS" : "RR"
        }: ${reducerRule.toString()} | ${anotherRule.toString()} next: ${unresolvedNext}`
      );
  }

  // check end
  const endHandlers = related.filter((r) => r.handleEnd);
  if (endHandlers.length > 1) {
    throw new ParserError(
      ParserErrorType.TOO_MANY_END_HANDLER,
      `Too many end handlers for rule ${endHandlers[0].reducerRule.toString()}`
    );
  }
  const unresolvedEnd = checkHandleEnd
    ? !endHandlers[0]?.handleEnd ?? true
    : false;

  return {
    next: unresolvedNext,
    /** If true, means user didn't handle end of input. */
    end: unresolvedEnd,
  };
}

export function getConflicts<T>(
  entryNTs: Set<string>,
  NTs: Set<string>,
  grs: GrammarRule<T>[],
  resolved: TempConflict<T>[],
  lexer?: ILexer,
  debug = false
) {
  const dfa = new DFA<T>(grs, entryNTs, NTs);
  const firstSets = dfa.getFirstSets();
  const followSets = dfa.getFollowSets();
  const endSet = getEndSet(entryNTs, grs);
  const states = dfa.calculateAllStates(lexer).getAllStates();

  const result = new Map<GrammarRule<T>, Conflict<T>[]>();

  // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
  // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
  for (let i = 0; i < grs.length; i++) {
    for (let j = 0; j < grs.length; j++) {
      const reducerRule = grs[i];
      const anotherRule = grs[j];
      const conflicts = reducerRule.checkRSConflict(anotherRule);
      conflicts.map((c) => {
        // try to auto resolve conflicts if possible
        // e.g. for a reduce-shift conflict: `A <= B C` and `D <= C E`
        // if A's follow overlap with E's first, then the conflict can't be auto resolved by LR1 peeking
        const A = c.reducerRule.NT;
        const E = c.shifterRule.rule[c.length];
        const EFirst = firstSets.get(E.content)!;
        const AFollow = followSets.get(A)!;
        if (E.type == GrammarType.NT) {
          // E is a NT, check if A's follow has some grammar that is also in E's first
          const overlap = AFollow.overlap(EFirst);
          if (overlap.length < 0) {
            // no overlap, conflicts can be auto resolved
            if (debug)
              console.log(
                `auto resolve RS: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
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
                `auto resolve RS: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
              );
            return;
          }

          // auto resolve failed, check if the conflicts are resolved by user
          const res = getUnresolvedConflicts(
            resolved,
            NTs,
            ConflictType.REDUCE_SHIFT,
            reducerRule,
            anotherRule,
            overlap,
            false, // for a RS conflict, we don't need to handle end of input
            debug
          );

          if (res.next.length > 0) {
            const conflict: Conflict<T> = {
              type: ConflictType.REDUCE_SHIFT,
              reducerRule,
              anotherRule,
              handleEnd: false,
              next: res.next,
              length: c.length,
            };
            if (result.has(reducerRule))
              result.get(reducerRule)!.push(conflict);
            else result.set(reducerRule, [conflict]);
          }
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
                  `auto resolve RS: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
                );
              return;
            }

            // auto resolve failed, check if the conflicts are resolved by user
            const res = getUnresolvedConflicts(
              resolved,
              NTs,
              ConflictType.REDUCE_SHIFT,
              reducerRule,
              anotherRule,
              [new Grammar({ content: E.content, type: GrammarType.T })],
              false, // for a RS conflict, we don't need to handle end of input
              debug
            );
            if (res.next.length > 0) {
              const conflict: Conflict<T> = {
                type: ConflictType.REDUCE_SHIFT,
                reducerRule,
                anotherRule,
                handleEnd: false,
                next: res.next,
                length: c.length,
              };
              if (result.has(reducerRule))
                result.get(reducerRule)!.push(conflict);
              else result.set(reducerRule, [conflict]);
            }
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
                  `auto resolve RS: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
                );
              return;
            }

            // auto resolve failed, check if the conflicts are resolved by user
            const res = getUnresolvedConflicts(
              resolved,
              NTs,
              ConflictType.REDUCE_SHIFT,
              reducerRule,
              anotherRule,
              [
                new Grammar({
                  content: E.content,
                  type: GrammarType.LITERAL,
                }),
              ],
              false, // for a RS conflict, we don't need to handle end of input
              debug
            );
            if (res.next.length > 0) {
              const conflict: Conflict<T> = {
                type: ConflictType.REDUCE_SHIFT,
                reducerRule,
                anotherRule,
                handleEnd: false,
                next: res.next,
                length: c.length,
              };
              if (result.has(reducerRule))
                result.get(reducerRule)!.push(conflict);
              else result.set(reducerRule, [conflict]);
            }
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
        if (overlap.length < 0) {
          // no overlap, all conflicts can be auto resolved
          if (debug)
            console.log(`auto resolve RR: ${reducerRule} ${anotherRule}`);
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
            console.log(`auto resolve RR: ${reducerRule} ${anotherRule}`);
          continue;
        }

        // auto resolve failed, check if the conflict is resolved by user
        const res = getUnresolvedConflicts(
          resolved,
          NTs,
          ConflictType.REDUCE_REDUCE,
          reducerRule,
          anotherRule,
          overlap,
          // for a RR conflict, we need to handle end of input if both's NT in end sets
          endSet.has(
            new Grammar({ type: GrammarType.NT, content: reducerRule.NT })
          ) &&
            endSet.has(
              new Grammar({ type: GrammarType.NT, content: anotherRule.NT })
            ),
          debug
        );
        if (res.next.length > 0) {
          const c: Conflict<T> = {
            type: ConflictType.REDUCE_REDUCE,
            reducerRule,
            anotherRule,
            handleEnd: false,
            next: res.next,
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(c);
          else result.set(reducerRule, [c]);
        }
        if (res.end) {
          const c: Conflict<T> = {
            type: ConflictType.REDUCE_REDUCE,
            reducerRule,
            anotherRule,
            handleEnd: true,
            next: [],
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(c);
          else result.set(reducerRule, [c]);
        }
      }
    }
  }

  return { conflicts: result, dfa };
}
