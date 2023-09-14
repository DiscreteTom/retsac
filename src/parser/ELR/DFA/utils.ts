import type { ILexer } from "../../../lexer";
import type { StringOrLiteral } from "../../../type-helper";
import type {
  ASTNodeSelector,
  ASTNodeFirstMatchSelector,
} from "../../selector";
import { ASTNode } from "../../ast";
import type {
  ParserBuilderData,
  ResolvedTempConflict,
  TempGrammarRule,
} from "../builder";
import { defToTempGRs } from "../builder/utils/definition";
import type {
  Grammar,
  GrammarRepo,
  GrammarRule,
  ReadonlyGrammarRuleRepo,
} from "../model";
import { ConflictType, GrammarSet, GrammarType } from "../model";
import type { CandidateRepo } from "./candidate";
import type { StateRepo } from "./state";

export function getAllNTClosure<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
>(
  NTs: ReadonlySet<string>,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >,
): Map<string, GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]> {
  const result = new Map<
    string,
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]
  >();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
>(
  NT: string,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >,
): GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[] {
  return getGrammarRulesClosure(
    allGrammarRules.filter((gr) => gr.NT == NT),
    allGrammarRules,
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `A <= @ B 'c'`, we should also have `B <= @ 'd'`.
 */
export function getGrammarRulesClosure<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
>(
  rules: readonly GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[],
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >,
): GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[] {
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
export function ASTNodeSelectorFactory<
  ASTData,
  ErrorType,
  AllKinds extends string,
>(
  cascadeQueryPrefix: string | undefined,
): ASTNodeSelector<ASTData, ErrorType, AllKinds> {
  return (
    name: StringOrLiteral<AllKinds>,
    nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
  ) => {
    const result: ASTNode<ASTData, ErrorType, AllKinds>[] = [];
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
export function ASTNodeFirstMatchSelectorFactory<
  ASTData,
  ErrorType,
  AllKinds extends string,
>(
  cascadeQueryPrefix: string | undefined,
): ASTNodeFirstMatchSelector<ASTData, ErrorType, AllKinds> {
  return (
    name: StringOrLiteral<AllKinds>,
    nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
  ) => {
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
export function lexGrammar<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  g: Grammar<Kinds | LexerKinds>,
  lexer: Readonly<ILexer<LexerError, LexerKinds>>,
): {
  node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
  lexer: ILexer<LexerError, LexerKinds>;
} | null {
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
  return {
    node: ASTNode.from<ASTData, ErrorType, Kinds | LexerKinds>(token),
    lexer,
  };
}

/**
 * Calculate state machine's state transition map ahead of time and cache.
 */
export function calculateAllStates<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  repo: GrammarRepo<Kinds | LexerKinds>,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >,
  allStates: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  NTClosures: Map<string, GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>[]>,
  cs: CandidateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
) {
  // collect all grammars in rules
  const gs = new GrammarSet<Kinds | LexerKinds>();
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
export function processDefinitions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
>(
  data: Readonly<ParserBuilderData<ASTData, ErrorType, Kinds, LexerKinds>>,
  resolvedTemp: readonly Readonly<
    ResolvedTempConflict<ASTData, ErrorType, Kinds, LexerKinds>
  >[],
): {
  tempGrammarRules: readonly TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >[];
  NTs: ReadonlySet<string>;
  allResolvedTemp: readonly Readonly<
    ResolvedTempConflict<ASTData, ErrorType, Kinds, LexerKinds>
  >[];
} {
  const tempGrammarRules: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds
  >[] = [];
  const NTs: Set<string> = new Set();
  const allResolvedTemp = [...resolvedTemp];

  data.forEach((d, hydrationId) => {
    const ctx = d.ctxBuilder?.build();
    const grs = defToTempGRs(d.defs, hydrationId, ctx);

    tempGrammarRules.push(...grs);
    grs.forEach((gr) => {
      NTs.add(gr.NT);
    });

    // append resolved conflicts defined in ctx into the front of allResolvedTemp
    const toBeAppend = [] as ResolvedTempConflict<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >[];
    ctx?.resolved?.forEach((r) => {
      if (r.type == ConflictType.REDUCE_REDUCE) {
        defToTempGRs<ASTData, ErrorType, Kinds, LexerKinds>(
          r.anotherRule,
          hydrationId,
        ).forEach((another) => {
          grs.forEach((gr) => {
            toBeAppend.push({
              type: ConflictType.REDUCE_REDUCE,
              reducerRule: gr,
              anotherRule: another,
              options: r.options,
              hydrationId: r.hydrationId,
            });
          });
        });
      } else {
        // ConflictType.REDUCE_SHIFT
        defToTempGRs<ASTData, ErrorType, Kinds, LexerKinds>(
          r.anotherRule,
          hydrationId,
        ).forEach((another) => {
          grs.forEach((gr) => {
            toBeAppend.push({
              type: ConflictType.REDUCE_SHIFT,
              reducerRule: gr,
              anotherRule: another,
              options: r.options,
              hydrationId: r.hydrationId,
            });
          });
        });
      }
    });
    allResolvedTemp.unshift(...toBeAppend);
  });

  return { tempGrammarRules, NTs, allResolvedTemp };
}

/**
 * Transform a Map to a serializable object.
 */
export function map2serializable<V, R>(
  map: ReadonlyMap<string, V>,
  transformer: (v: V) => R,
) {
  const obj = {} as { [key: string]: R };
  map.forEach((v, k) => (obj[k] = transformer(v)));
  return obj;
}

export function serializable2map<V, R>(
  obj: { [key: string]: R },
  transformer: (v: R) => V,
) {
  const map = new Map<string, V>();
  Object.entries(obj).forEach(([k, v]) => map.set(k, transformer(v)));
  return map;
}
