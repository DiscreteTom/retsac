import { GrammarRule, GrammarType } from "../model";

export function getAllNTClosure<T, After>(
  NTs: ReadonlySet<string>,
  allGrammarRules: readonly GrammarRule<T, After>[]
): Map<string, GrammarRule<T, After>[]> {
  const result = new Map<string, GrammarRule<T, After>[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<T, After>(
  NT: string,
  allGrammarRules: readonly GrammarRule<T, After>[]
): GrammarRule<T, After>[] {
  return getGrammarRulesClosure(
    allGrammarRules.filter((gr) => gr.NT == NT),
    allGrammarRules
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `A <= @ B 'c'`, we should also have `B <= @ 'd'`.
 */
export function getGrammarRulesClosure<T, After>(
  rules: readonly GrammarRule<T, After>[],
  allGrammarRules: readonly GrammarRule<T, After>[]
): GrammarRule<T, After>[] {
  const result = [...rules];

  while (true) {
    let changed = false;
    result.map((gr) => {
      if (gr.rule[0].type == GrammarType.NT) {
        allGrammarRules
          .filter((gr2) => gr2.NT == gr.rule[0].content)
          .map((gr) => {
            if (result.includes(gr)) return;
            changed = true;
            result.push(gr);
          });
      }
    });

    if (!changed) break;
  }

  return result;
}
