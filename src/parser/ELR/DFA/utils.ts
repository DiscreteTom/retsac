import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  IReadonlyLexer,
  IReadonlyTrimmedLexer,
  ITrimmedLexer,
  Token,
} from "../../../lexer";
import type { StringOrLiteral } from "../../../helper";
import type {
  ASTNodeSelector,
  ASTNodeFirstMatchSelector,
} from "../../selector";
import { TheTNode } from "../../ast";
import type { ASTNode, TNode } from "../../ast";
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
  TokenASTDataMapperExec,
} from "../model";
import { ConflictType, GrammarSet, GrammarType } from "../model";
import type { CandidateRepo } from "./candidate";
import type { StateRepo } from "./state";
import type {
  ReadonlyFirstSets,
  ReadonlyFollowSets,
  ReadonlyNTClosures,
} from "./model";

export function getAllNTClosure<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  NTs: ReadonlySet<NTs>,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
): ReadonlyNTClosures<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType,
  Global
> {
  const result = new Map<
    NTs,
    GrammarRule<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >[]
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  NT: NTs,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
): GrammarRule<
  NTs,
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType,
  Global
>[] {
  return getGrammarRulesClosure(
    allGrammarRules.filter((gr) => gr.NT === NT),
    allGrammarRules,
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `A <= # B 'c'`, we should also have `B <= # 'd'`.
 */
export function getGrammarRulesClosure<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  rules: readonly GrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[],
  allGrammarRules: ReadonlyGrammarRuleRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
): GrammarRule<
  NTs,
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType,
  Global
>[] {
  const result = [...rules];

  while (true) {
    let changed = false;
    result.forEach((gr) => {
      if (gr.rule[0].type === GrammarType.NT) {
        allGrammarRules
          .filter((gr2) => gr2.NT === gr.rule[0].kind)
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerErrorType,
  Global,
>(
  cascadeQueryPrefix: string | undefined,
): ASTNodeSelector<
  NTs,
  ASTData,
  ErrorType,
  Token<LexerDataBindings, LexerErrorType>,
  Global
> {
  return ((
    name: StringOrLiteral<NTs | ExtractKinds<LexerDataBindings>>,
    nodes: readonly ASTNode<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >[],
  ) => {
    const result: ASTNode<
      NTs | ExtractKinds<LexerDataBindings>,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >[] = [];
    nodes.forEach((n) => {
      if (n.name === name) result.push(n);

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix) &&
        n.isNT()
      ) {
        result.push(
          ...(n.$$(name) as ASTNode<
            NTs | ExtractKinds<Token<LexerDataBindings, LexerErrorType>>,
            NTs,
            ASTData,
            ErrorType,
            Token<LexerDataBindings, LexerErrorType>,
            Global
          >[]),
        );
      }
    });
    return result;
  }) as ASTNodeSelector<
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>,
    Global
  >;
}
export function cascadeASTNodeFirstMatchSelectorFactory<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerErrorType,
  Global,
>(
  cascadeQueryPrefix: string | undefined,
): ASTNodeFirstMatchSelector<
  NTs,
  ASTData,
  ErrorType,
  Token<LexerDataBindings, LexerErrorType>,
  Global
> {
  return ((
    name: StringOrLiteral<NTs | ExtractKinds<LexerDataBindings>>,
    nodes: readonly ASTNode<
      NTs,
      NTs,
      ASTData,
      ErrorType,
      Token<LexerDataBindings, LexerErrorType>,
      Global
    >[],
  ) => {
    for (const n of nodes) {
      if (n.name === name) return n;

      // cascade query
      if (
        cascadeQueryPrefix !== undefined &&
        n.name.startsWith(cascadeQueryPrefix) &&
        n.isNT()
      ) {
        const result = n.$(name);
        if (result !== undefined) return result;
      }
    }
    return undefined;
  }) as ASTNodeFirstMatchSelector<
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>,
    Global
  >;
}

/**
 * Try to use lexer to yield the specified grammar.
 *
 * The caller should make sure that the grammar is not a NT.
 */
export function lexGrammar<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  g: Grammar<ExtractKinds<LexerDataBindings>>,
  lexer: IReadonlyTrimmedLexer<
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >,
  tokenASTDataMapper: ReadonlyMap<
    ExtractKinds<LexerDataBindings>,
    TokenASTDataMapperExec<LexerDataBindings, LexerErrorType, ASTData>
  >,
  global: Global,
):
  | {
      node: TNode<
        ExtractKinds<LexerDataBindings>,
        NTs,
        ASTData,
        ErrorType,
        Token<LexerDataBindings, LexerErrorType>,
        Global
      >;
      lexer: ITrimmedLexer<LexerDataBindings, LexerActionState, LexerErrorType>;
    }
  | undefined {
  // prevent side effect. we can't use peek here since the lexer's state will be changed after re-lex
  // so we will need many lexers with different states
  const mutableLexer = lexer.clone(); // TODO: is there a way to prevent clone every time?

  const token = mutableLexer.lex({
    expect: {
      kind: g.kind,
      text: g.text, // maybe undefined
    },
  });

  return token === null
    ? undefined
    : {
        node: TheTNode.from<
          NTs,
          ASTData,
          ErrorType,
          Token<LexerDataBindings, LexerErrorType>,
          Global
        >(token, tokenASTDataMapper.get(token.kind)?.(token), global),
        lexer: mutableLexer.trimStart(),
      };
}

/**
 * Calculate state machine's state transition map ahead of time and cache.
 */
export function calculateAllStates<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  repo: GrammarRepo<NTs, ExtractKinds<LexerDataBindings>>,
  allGrammarRules: ReadonlyGrammarRuleRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  allStates: StateRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  NTClosures: ReadonlyNTClosures<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  cs: CandidateRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) {
  // collect all grammars in grammar rules.
  // don't convert grammar rules' NTs into ASTNodes,
  // some NTs might not appear in grammar rules (entry-only NTs).
  // when we enable ignoreEntryFollow, the entry-only NTs
  // may appear as the first node in parser's buffer,
  // and the `parser.parse` will throw StateCacheMissError.
  // if we do convert entry-only NTs into ASTNodes,
  // the `parser.parse` will just reject the input without throwing StateCacheMissError.
  const gs = new GrammarSet<NTs, ExtractKinds<LexerDataBindings>>();
  allGrammarRules.grammarRules.forEach((gr) => {
    gr.rule.forEach((g) => {
      gs.add(g);
    });
  });

  while (true) {
    let changed = false;
    allStates.states.forEach((state) => {
      gs.grammars.forEach((node) => {
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  data: readonly Readonly<
    ParserBuilderData<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >[],
): {
  tempGrammarRules: readonly TempGrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[];
  NTs: ReadonlySet<NTs>;
  resolvedTemps: readonly Readonly<
    ResolvedTempConflict<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >[];
} {
  const tempGrammarRules: TempGrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >[] = [];
  const NTs: Set<NTs> = new Set();
  const resolvedTemps = [] as ResolvedTempConflict<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
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
      if (r.type === ConflictType.REDUCE_REDUCE) {
        defToTempGRs<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >(r.anotherRule).forEach((another) => {
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
        defToTempGRs<
          NTs,
          ASTData,
          ErrorType,
          LexerDataBindings,
          LexerActionState,
          LexerErrorType,
          Global
        >(r.anotherRule).forEach((another) => {
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
 * The result is `JSON.stringify`-ed.
 * This is used for debugging.
 */
export function prettierLexerRest<
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
>(lexer: IReadonlyLexer<LexerDataBindings, LexerActionState, LexerErrorType>) {
  const showLength = 30;
  return `${JSON.stringify(
    lexer.buffer.slice(lexer.digested, lexer.digested + showLength),
  )}${
    lexer.buffer.length - lexer.digested > showLength
      ? `...${lexer.buffer.length - lexer.digested - showLength} more chars`
      : ""
  }`;
}

/**
 * Construct first sets for all NTs.
 */
export function buildFirstSets<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  NTs: ReadonlySet<NTs>,
  NTClosures: ReadonlyNTClosures<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
) {
  const firstSets = new Map<
    NTs,
    GrammarSet<NTs, ExtractKinds<LexerDataBindings>>
  >();

  NTs.forEach((NT) => firstSets.set(NT, new GrammarSet())); // init
  NTClosures.forEach((grs, NT) => {
    const gs = firstSets.get(NT);
    // for each direct/indirect grammar rule, add first grammar to first set
    // including T and NT since we are using NT closures
    grs.forEach((gr) => gs!.add(gr.rule[0]));
  });

  return firstSets as ReadonlyFirstSets<NTs, ExtractKinds<LexerDataBindings>>;
}

/**
 * Construct follow sets for all grammars.
 */
export function buildFollowSets<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
>(
  NTs: ReadonlySet<NTs>,
  grs: ReadonlyGrammarRuleRepo<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >,
  firstSets: ReadonlyFirstSets<NTs, ExtractKinds<LexerDataBindings>>,
) {
  const followSets = new Map<
    NTs | ExtractKinds<LexerDataBindings>,
    GrammarSet<NTs, ExtractKinds<LexerDataBindings>>
  >();

  NTs.forEach((NT) => followSets.set(NT, new GrammarSet())); // init for all NTs
  grs.grammarRules.forEach((gr) => {
    gr.rule.forEach((g, i, rule) => {
      if (!followSets.has(g.kind)) {
        // if g is a T (including literal), it might not have a follow set
        // because we just init all follow sets only for NTs
        // so now we init a new empty set for it
        followSets.set(g.kind, new GrammarSet());
      }
      if (i < rule.length - 1) {
        // next grammar exists, merge the current grammar's follow set with next grammar
        const gs = followSets.get(g.kind)!;
        gs.add(rule[i + 1]);
        // if next grammar is also NT, merge with its first set
        if (rule[i + 1].type === GrammarType.NT)
          firstSets
            .get(rule[i + 1].kind as NTs)!
            .grammars.forEach((g) => gs.add(g));
      }
    });
  });
  // the last grammar's follow set should merge with the target NT's follow set
  // be ware: don't merge the target NT's follow set with the last grammar's follow set
  // the last grammar's follow set should be a super set of the target NT's follow set, not vice versa
  while (true) {
    let changed = false;

    grs.grammarRules.forEach((gr) => {
      followSets
        .get(gr.NT)! // target NT's follow set
        .grammars.forEach(
          (g) => (changed ||= followSets.get(gr.rule.at(-1)!.kind)!.add(g)),
        );
    });

    if (!changed) break;
  }

  return followSets as ReadonlyFollowSets<NTs, ExtractKinds<LexerDataBindings>>;
}
