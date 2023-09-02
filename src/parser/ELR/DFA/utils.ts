import { ILexer } from "../../../lexer";
import { ASTNodeSelector, ASTNode } from "../../ast";
import { Grammar, GrammarRule, GrammarType } from "../model";

export function getAllNTClosure<T>(
  NTs: ReadonlySet<string>,
  allGrammarRules: readonly GrammarRule<T>[]
): Map<string, GrammarRule<T>[]> {
  const result = new Map<string, GrammarRule<T>[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<T>(
  NT: string,
  allGrammarRules: readonly GrammarRule<T>[]
): GrammarRule<T>[] {
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
export function getGrammarRulesClosure<T>(
  rules: readonly GrammarRule<T>[],
  allGrammarRules: readonly GrammarRule<T>[]
): GrammarRule<T>[] {
  const result = [...rules];

  while (true) {
    let changed = false;
    result.forEach((gr) => {
      if (gr.rule[0].type == GrammarType.NT) {
        allGrammarRules
          .filter((gr2) => gr2.NT == gr.rule[0].kind)
          .forEach((gr) => {
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

// this function is especially for ELR parser
// since the cascade query is only used in ELR parser
// so don't move this into ast.ts file
export function ASTNodeSelectorFactory<T>(
  cascadeQueryPrefix: string | undefined
): ASTNodeSelector<T> {
  return (name: string, nodes: readonly ASTNode<T>[]) => {
    const result: ASTNode<T>[] = [];
    nodes.forEach((n) => {
      if (n.name === name) result.push(n);

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix)
      )
        result.push(...n.$(name));
    });
    return result;
  };
}

/**
 * Try to use lexer to yield the specified grammar.
 * Return `null` if failed.
 */
export function lexGrammar<T>(
  g: Grammar,
  lexer: Readonly<ILexer<any>>
): { node: ASTNode<T>; lexer: ILexer<any> } | null {
  if (g.type == GrammarType.NT) {
    // NT can't be lexed
    return null;
  }

  // try to lex to get the token
  lexer = lexer.clone(); // prevent side effect // TODO: don't clone lexer, use peek?
  const token = lexer.lex({
    expect: {
      kind: g.kind,
      text: g.text, // maybe undefined
    },
  });
  if (token == null) return null;
  return { node: ASTNode.from<T>(token), lexer };
}
