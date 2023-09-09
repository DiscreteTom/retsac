import { ILexer } from "../../../lexer";
import { ASTNodeSelector, ASTNode, ASTNodeFirstMatchSelector } from "../../ast";
import {
  ParserBuilderData,
  ResolvedTempConflict,
  TempGrammarRule,
} from "../builder";
import { defToTempGRs } from "../builder/utils/definition";
import {
  ConflictType,
  Grammar,
  GrammarRepo,
  GrammarRule,
  GrammarRuleRepo,
  GrammarSet,
  GrammarType,
} from "../model";
import { CandidateRepo } from "./candidate";
import { StateRepo } from "./state";

export function getAllNTClosure<ASTData, Kinds extends string>(
  NTs: ReadonlySet<string>,
  allGrammarRules: GrammarRuleRepo<ASTData, Kinds>
): Map<string, GrammarRule<ASTData, Kinds>[]> {
  const result = new Map<string, GrammarRule<ASTData, Kinds>[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<ASTData, Kinds extends string>(
  NT: string,
  allGrammarRules: GrammarRuleRepo<ASTData, Kinds>
): GrammarRule<ASTData, Kinds>[] {
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
export function getGrammarRulesClosure<ASTData, Kinds extends string>(
  rules: readonly GrammarRule<ASTData, Kinds>[],
  allGrammarRules: GrammarRuleRepo<ASTData, Kinds>
): GrammarRule<ASTData, Kinds>[] {
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
export function ASTNodeSelectorFactory<ASTData, Kinds extends string>(
  cascadeQueryPrefix: string | undefined
): ASTNodeSelector<ASTData, Kinds> {
  return (name: string, nodes: readonly ASTNode<ASTData, Kinds>[]) => {
    const result: ASTNode<ASTData, Kinds>[] = [];
    nodes.forEach((n) => {
      if (n.name === name) result.push(n);

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix)
      )
        result.push(...n.$$(name));
    });
    return result;
  };
}
export function ASTNodeFirstMatchSelectorFactory<ASTData, Kinds extends string>(
  cascadeQueryPrefix: string | undefined
): ASTNodeFirstMatchSelector<ASTData, Kinds> {
  return (name: string, nodes: readonly ASTNode<ASTData, Kinds>[]) => {
    for (const n of nodes) {
      if (n.name === name) return n;

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix)
      ) {
        const result = n.$(name);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  };
}

/**
 * Try to use lexer to yield the specified grammar.
 * Return `null` if failed.
 */
export function lexGrammar<ASTData, Kinds extends string>(
  g: Grammar,
  lexer: Readonly<ILexer<any, any>>
): { node: ASTNode<ASTData, Kinds>; lexer: ILexer<any, any> } | null {
  if (g.type == GrammarType.NT) {
    // NT can't be lexed
    return null;
  }

  // try to lex to get the token
  lexer = lexer.clone(); // prevent side effect. we can't use peek here since the lexer's state will be changed after re-lex, so we will need many lexers with different states
  const token = lexer.lex({
    expect: {
      kind: g.kind,
      text: g.text, // maybe undefined
    },
  });
  if (token == null) return null;
  return { node: ASTNode.from<ASTData, Kinds>(token), lexer };
}

/**
 * Calculate state machine's state transition map ahead of time and cache.
 */
export function calculateAllStates<ASTData, Kinds extends string>(
  repo: GrammarRepo,
  allGrammarRules: GrammarRuleRepo<ASTData, Kinds>,
  allStates: StateRepo<ASTData, Kinds>,
  NTClosures: Map<string, GrammarRule<ASTData, Kinds>[]>,
  cs: CandidateRepo<ASTData, Kinds>
) {
  // collect all grammars in rules
  const gs = new GrammarSet();
  allGrammarRules.grammarRules.forEach((gr) => {
    gr.rule.forEach((g) => {
      gs.add(g);
    });
  });
  // convert to mock AST node
  const mockNodes = gs.map((g) => g.mockNode.value);

  while (true) {
    let changed = false;
    allStates.states.forEach((state) => {
      mockNodes.forEach((node) => {
        if (state.generateNext(repo, node, NTClosures, allStates, cs).changed)
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
export function processDefinitions<ASTData, Kinds extends string>(
  data: ParserBuilderData<ASTData, Kinds>,
  /**
   * This will be modified to add the resolved conflicts defined in definition context in data.
   * Since the definition context has higher priority,
   * those resolved conflicts will be append to the front of this array.
   */
  resolvedTemp: ResolvedTempConflict<ASTData, Kinds>[]
): {
  tempGrammarRules: readonly TempGrammarRule<ASTData, Kinds>[];
  NTs: ReadonlySet<string>;
} {
  const tempGrammarRules: TempGrammarRule<ASTData, Kinds>[] = [];
  const NTs: Set<string> = new Set();

  data.forEach((d, hydrationId) => {
    const ctx = d.ctxBuilder?.build();
    const grs = defToTempGRs(d.defs, hydrationId, ctx);

    tempGrammarRules.push(...grs);
    grs.forEach((gr) => {
      NTs.add(gr.NT);
    });

    // append resolved conflicts defined in ctx into the front of resolvedTemp
    const toBeAppend = [] as ResolvedTempConflict<ASTData, Kinds>[];
    ctx?.resolved?.forEach((r) => {
      if (r.type == ConflictType.REDUCE_REDUCE) {
        defToTempGRs<ASTData, Kinds>(r.anotherRule, hydrationId).forEach(
          (another) => {
            grs.forEach((gr) => {
              toBeAppend.push({
                type: ConflictType.REDUCE_REDUCE,
                reducerRule: gr,
                anotherRule: another,
                options: r.options,
                hydrationId: r.hydrationId,
              });
            });
          }
        );
      } else {
        // ConflictType.REDUCE_SHIFT
        defToTempGRs<ASTData, Kinds>(r.anotherRule, hydrationId).forEach(
          (another) => {
            grs.forEach((gr) => {
              toBeAppend.push({
                type: ConflictType.REDUCE_SHIFT,
                reducerRule: gr,
                anotherRule: another,
                options: r.options,
                hydrationId: r.hydrationId,
              });
            });
          }
        );
      }
    });
    resolvedTemp.unshift(...toBeAppend);
  });

  return { tempGrammarRules, NTs };
}

/**
 * Transform a Map to a serializable object.
 */
export function map2serializable<V, R>(
  map: ReadonlyMap<string, V>,
  transformer: (v: V) => R
) {
  const obj = {} as { [key: string]: R };
  map.forEach((v, k) => (obj[k] = transformer(v)));
  return obj;
}

export function serializable2map<V, R>(
  obj: { [key: string]: R },
  transformer: (v: R) => V
) {
  const map = new Map<string, V>();
  Object.entries(obj).forEach(([k, v]) => map.set(k, transformer(v)));
  return map;
}
