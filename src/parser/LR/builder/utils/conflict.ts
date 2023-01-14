import { ILexer } from "../../../../lexer";
import { ASTNode } from "../../../ast";
import {
  Conflict,
  ConflictType,
  Grammar,
  GrammarRule,
  GrammarType,
  TempConflict,
} from "../../../base";
import {
  getEndSet,
  getUnresolvedConflicts,
} from "../../../base/builder/utils/conflict";
import { Candidate, DFA, State } from "../../DFA";
import { ParserContext } from "../../model";

export function getConflicts<T>(
  entryNTs: ReadonlySet<string>,
  NTs: ReadonlySet<string>,
  grs: readonly GrammarRule<T, ASTNode<T>[]>[],
  // `resolved` should be TempConflict instead of Conflict, because check GrammarRule equality using Object reference instead of content.
  // If we construct Conflict(GrammarRule) which is not in `grs`, then the equality check will fail in DFA `candidate.eq`.
  resolved: readonly TempConflict<T, ASTNode<T>[], ParserContext<T>>[],
  lexer?: ILexer,
  debug = false
) {
  const dfa = new DFA<T>(grs, entryNTs, NTs);
  const firstSets = dfa.getFirstSets();
  const followSets = dfa.getFollowSets();
  const endSet = getEndSet(entryNTs, grs);
  const states = dfa.calculateAllStates(lexer).getAllStates();

  const result = new Map<
    GrammarRule<T, ASTNode<T>[]>,
    Conflict<T, ASTNode<T>[]>[]
  >();

  // if the tail of a grammar rule is the same as the head of another grammar rule, it's a reduce-shift conflict
  // e.g. `exp '+' exp | exp '*' exp` is a reduce-shift conflict, `A B C | B C D` is a reduce-shift conflict
  // the following code will check every grammar rule pair, another way is to check every DFA state
  // but different DFA states may contain same grammar rules which will cause duplicate check
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
            const conflict: Conflict<T, ASTNode<T>[]> = {
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
                  `[auto resolve RS (DFA state)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
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
              const conflict: Conflict<T, ASTNode<T>[]> = {
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
                  `[auto resolve RS (DFA state)]: ${c.reducerRule.toString()} | ${c.shifterRule.toString()}`
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
              const conflict: Conflict<T, ASTNode<T>[]> = {
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
        if (res.next.length > 0 || res.end) {
          const c: Conflict<T, ASTNode<T>[]> = {
            type: ConflictType.REDUCE_REDUCE,
            reducerRule,
            anotherRule,
            handleEnd: res.end,
            next: res.next,
          };
          if (result.has(reducerRule)) result.get(reducerRule)!.push(c);
          else result.set(reducerRule, [c]);
        }
      }
    }
  }

  return { conflicts: result, dfa };
}
