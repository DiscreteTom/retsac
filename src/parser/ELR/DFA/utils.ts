import { ILexer } from "../../../lexer";
import { ASTNodeSelector, ASTNode } from "../../ast";
import {
  ParserBuilderData,
  ResolvedTempConflict,
  TempGrammarRule,
} from "../builder";
import { defToTempGRs } from "../builder/utils/definition";
import {
  ConflictType,
  Grammar,
  GrammarRule,
  GrammarRuleRepo,
  GrammarSet,
  GrammarType,
} from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";

export function getAllNTClosure<T, Kinds extends string>(
  NTs: ReadonlySet<string>,
  allGrammarRules: GrammarRuleRepo<T, Kinds>
): Map<string, GrammarRule<T, Kinds>[]> {
  const result = new Map<string, GrammarRule<T, Kinds>[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<T, Kinds extends string>(
  NT: string,
  allGrammarRules: GrammarRuleRepo<T, Kinds>
): GrammarRule<T, Kinds>[] {
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
export function getGrammarRulesClosure<T, Kinds extends string>(
  rules: readonly GrammarRule<T, Kinds>[],
  allGrammarRules: GrammarRuleRepo<T, Kinds>
): GrammarRule<T, Kinds>[] {
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
export function ASTNodeSelectorFactory<T, Kinds extends string>(
  cascadeQueryPrefix: string | undefined
): ASTNodeSelector<T, Kinds> {
  return (name: string, nodes: readonly ASTNode<T, Kinds>[]) => {
    const result: ASTNode<T, Kinds>[] = [];
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
export function lexGrammar<T, Kinds extends string>(
  g: Grammar,
  lexer: Readonly<ILexer<any, any>>
): { node: ASTNode<T, Kinds>; lexer: ILexer<any, any> } | null {
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
  return { node: ASTNode.from<T, Kinds>(token), lexer };
}

/**
 * Calculate state machine's state transition map ahead of time and cache.
 */
export function calculateAllStates<T, Kinds extends string>(
  allGrammarRules: GrammarRuleRepo<T, Kinds>,
  allStates: Map<string, State<T, Kinds>>,
  NTClosures: Map<string, GrammarRule<T, Kinds>[]>,
  allInitialCandidates: Map<string, Candidate<T, Kinds>>
) {
  // collect all grammars in rules
  const gs = new GrammarSet();
  allGrammarRules.grammarRules.forEach((gr) => {
    gr.rule.forEach((g) => {
      gs.add(g);
    });
  });
  // convert to mock AST node
  const mockNodes = gs.map((g) => g.toMockASTNode());

  while (true) {
    let changed = false;
    allStates.forEach((state) => {
      mockNodes.forEach((node) => {
        if (
          state.getNext(node, NTClosures, allStates, allInitialCandidates)
            .changed
        )
          changed = true;
      });
    });
    if (!changed) break;
  }
}

/**
 * Transform the data user defined into temp grammar rules,
 * and append resolved conflicts defined in definition context in data into resolvedTemp.
 */
export function processDefinitions<T, Kinds extends string>(
  data: ParserBuilderData<T, Kinds>,
  /**
   * This will be modified to add the resolved conflicts defined in definition context in data.
   * Since the definition context has higher priority,
   * those resolved conflicts will be append to the front of this array.
   */
  resolvedTemp: ResolvedTempConflict<T, Kinds>[]
): {
  tempGrammarRules: readonly TempGrammarRule<T, Kinds>[];
  NTs: ReadonlySet<string>;
} {
  const tempGrammarRules: TempGrammarRule<T, Kinds>[] = [];
  const NTs: Set<string> = new Set();

  data.forEach((d) => {
    const ctx = d.ctxBuilder?.build();
    const grs = defToTempGRs(d.defs, ctx);

    tempGrammarRules.push(...grs);
    grs.forEach((gr) => {
      NTs.add(gr.NT);
    });

    // append resolved conflicts defined in ctx into the front of resolvedTemp
    const toBeAppend = [] as ResolvedTempConflict<T, Kinds>[];
    ctx?.resolved?.forEach((r) => {
      if (r.type == ConflictType.REDUCE_REDUCE) {
        defToTempGRs<T, Kinds>(r.anotherRule).forEach((another) => {
          grs.forEach((gr) => {
            toBeAppend.push({
              type: ConflictType.REDUCE_REDUCE,
              reducerRule: gr,
              anotherRule: another,
              options: r.options,
            });
          });
        });
      } else {
        // ConflictType.REDUCE_SHIFT
        defToTempGRs<T, Kinds>(r.anotherRule).forEach((another) => {
          grs.forEach((gr) => {
            toBeAppend.push({
              type: ConflictType.REDUCE_SHIFT,
              reducerRule: gr,
              anotherRule: another,
              options: r.options,
            });
          });
        });
      }
    });
    resolvedTemp.unshift(...toBeAppend);
  });

  return { tempGrammarRules, NTs };
}
