import { ILexer } from "../../../lexer";
import { GrammarRule, GrammarSet, GrammarType } from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";
import { getGrammarRulesClosure, getAllNTClosure } from "./utils";

export class DFABuilder {
  static build<T>(
    lexer: ILexer,
    allGrammarRules: readonly GrammarRule<T>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>
  ) {
    // init all initial candidates, initial candidate is candidate with digested=0
    const allInitialCandidates = new Map<string, Candidate<T>>();
    allGrammarRules.forEach((gr) => {
      const c = new Candidate<T>({ gr, digested: 0 });
      allInitialCandidates.set(c.toString(), c);
    });

    const entryState = new State<T>(
      getGrammarRulesClosure(
        allGrammarRules.filter((gr) => entryNTs.has(gr.NT)),
        allGrammarRules
      ).map(
        (gr) =>
          // get initial candidate from global cache
          allInitialCandidates.get(Candidate.getString({ gr, digested: 0 }))!
      )
    );
    const NTClosures = getAllNTClosure(NTs, allGrammarRules);

    // init all states
    const allStatesCache = new Map<string, State<T>>();
    allStatesCache.set(entryState.toString(), entryState);

    // construct first sets for all NTs
    const firstSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => firstSets.set(NT, new GrammarSet())); // init
    NTClosures.forEach((grs, NT) => {
      const gs = firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.map((gr) => gs!.add(gr.rule[0]));
    });

    // construct follow sets for all grammars
    const followSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => followSets.set(NT, new GrammarSet())); // init for all NTs
    allGrammarRules.map((gr) => {
      gr.rule.map((g, i, rule) => {
        if (!followSets.has(g.content)) {
          // if g is a T/Literal, it might not have a follow set
          followSets.set(g.content, new GrammarSet());
        }
        if (i < rule.length - 1) {
          // next grammar exists, merge the current grammar's follow set with next grammar
          const gs = followSets.get(g.content)!;
          gs.add(rule[i + 1]);
          // if next grammar is also NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            firstSets.get(rule[i + 1].content)!.map((g) => gs.add(g));
        }
      });
    });
    // the last grammar's follow set should merge with the target NT's follow set, vice versa
    while (true) {
      let changed = false;

      allGrammarRules.map((gr) => {
        followSets
          .get(gr.NT)! // target NT's follow set
          .map(
            (g) => (changed ||= followSets.get(gr.rule.at(-1)!.content)!.add(g))
          );
        followSets
          .get(gr.rule.at(-1)!.content)! // last grammar's follow set
          .map((g) => (changed ||= followSets.get(gr.NT)!.add(g)));
      });

      if (!changed) break;
    }

    calculateAllStates(
      lexer,
      allGrammarRules,
      allStatesCache,
      NTClosures,
      allInitialCandidates
    );

    return [
      allGrammarRules,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStatesCache,
    ] as const;
  }
}

/**
 * Calculate state machine's state transition map ahead of time and cache.
 */
function calculateAllStates<T>(
  lexer: ILexer,
  allGrammarRules: readonly GrammarRule<T>[],
  allStates: Map<string, State<T>>,
  NTClosures: Map<string, GrammarRule<T>[]>,
  allInitialCandidates: Map<string, Candidate<T>>
) {
  // collect all grammars in rules
  const gs = new GrammarSet();
  allGrammarRules.forEach((gr) => {
    gr.rule.forEach((g) => {
      gs.add(g);
    });
  });
  // convert to mock AST node
  const mockNodes = gs.map((g) => g.toTempASTNode(lexer));

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
