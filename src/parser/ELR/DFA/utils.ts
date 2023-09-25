import type { ILexer, ReadonlyILexer } from "../../../lexer";
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
  LexerError,
>(
  NTs: ReadonlySet<Kinds>,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
): Map<
  Kinds,
  GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
> {
  const result = new Map<
    Kinds,
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
  >();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= # A`, we should also have `A <= # B 'c'` and `B <= # 'd'`.
 * In this case, `A <= # B 'c'` and `B <= # 'd'` are the closure of the NT 'A'.
 */
export function getNTClosure<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  NT: Kinds,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
): GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[] {
  return getGrammarRulesClosure(
    allGrammarRules.filter((gr) => gr.NT == NT),
    allGrammarRules,
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `A <= # B 'c'`, we should also have `B <= # 'd'`.
 */
export function getGrammarRulesClosure<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  rules: readonly GrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[],
  allGrammarRules: ReadonlyGrammarRuleRepo<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >,
): GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[] {
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
export function cascadeASTNodeSelectorFactory<
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
export function cascadeASTNodeFirstMatchSelectorFactory<
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
 *
 * The caller should make sure that the grammar is not a NT.
 */
export function lexGrammar<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  g: Grammar<Kinds | LexerKinds>,
  roLexer: ReadonlyILexer<LexerError, LexerKinds>,
):
  | {
      node: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>;
      lexer: ILexer<LexerError, LexerKinds>;
    }
  | undefined {
  // prevent side effect. we can't use peek here since the lexer's state will be changed after re-lex
  // so we will need many lexers with different states
  const lexer = roLexer.clone();

  const token = lexer.lex({
    expect: {
      kind: g.kind,
      text: g.text, // maybe undefined
    },
  });

  return token == null
    ? undefined
    : {
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
    LexerKinds,
    LexerError
  >,
  allStates: StateRepo<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  NTClosures: Map<
    Kinds,
    GrammarRule<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[]
  >,
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
 * collect all resolved conflicts in `resolvedTemp`.
 */
export function processDefinitions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
>(
  data: readonly Readonly<
    ParserBuilderData<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >[],
): {
  tempGrammarRules: readonly TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];
  NTs: ReadonlySet<Kinds>;
  resolvedTemps: readonly Readonly<
    ResolvedTempConflict<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
  >[];
} {
  const tempGrammarRules: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[] = [];
  const NTs: Set<Kinds> = new Set();
  const resolvedTemps = [] as ResolvedTempConflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];

  data.forEach((d) => {
    const ctx = d.ctxBuilder?.build();
    const grs = defToTempGRs(d.defs, d.hydrationId, ctx);

    // don't record temp grammar rules if only resolve conflicts
    if (!d.resolveOnly) tempGrammarRules.push(...grs);

    grs.forEach((gr) => {
      NTs.add(gr.NT);
    });

    ctx?.resolved?.forEach((r) => {
      if (r.type == ConflictType.REDUCE_REDUCE) {
        defToTempGRs<ASTData, ErrorType, Kinds, LexerKinds, LexerError>(
          r.anotherRule,
        ).forEach((another) => {
          grs.forEach((gr) => {
            resolvedTemps.push({
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
        defToTempGRs<ASTData, ErrorType, Kinds, LexerKinds, LexerError>(
          r.anotherRule,
        ).forEach((another) => {
          grs.forEach((gr) => {
            resolvedTemps.push({
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
  });

  return { tempGrammarRules, NTs, resolvedTemps };
}

/**
 * Transform a Map to a serializable object.
 */
export function map2serializable<K, V, R>(
  map: ReadonlyMap<K, V>,
  keyTransformer: (k: K) => string,
  valueTransformer: (v: V) => R,
) {
  const obj = {} as { [key: string]: R };
  map.forEach((v, k) => (obj[keyTransformer(k)] = valueTransformer(v)));
  return obj;
}

/**
 * Transform a Map with string as the key to a serializable object.
 */
export function stringMap2serializable<K extends string, V, R>(
  map: ReadonlyMap<K, V>,
  transformer: (v: V) => R,
) {
  const obj = {} as { [key in K]: R };
  map.forEach((v, k) => (obj[k] = transformer(v)));
  return obj;
}

export function serializable2map<K extends string, V, R>(
  obj: { [key in K]: R },
  transformer: (v: R) => V,
) {
  const map = new Map<K, V>();
  for (const key in obj) {
    map.set(key, transformer(obj[key]));
  }
  return map;
}

/**
 * Return a string to represent the rest of the lexer.
 * This is used for debugging.
 */
export function prettierLexerRest(lexer: ReadonlyILexer<unknown, string>) {
  const showLength = 30;
  return `${JSON.stringify(
    lexer.buffer.slice(lexer.digested, lexer.digested + showLength),
  )}${
    lexer.buffer.length - lexer.digested > showLength
      ? `...${lexer.buffer.length - lexer.digested - showLength} more chars`
      : ""
  }`;
}
