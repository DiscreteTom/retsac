import {
  BaseParserContext,
  GrammarRule,
  CandidateClassCtor,
  StateClassCtor,
  GrammarSet,
  GrammarType,
} from "../model";
import { BaseCandidate } from "./candidate";
import { BaseState } from "./state";
import { getGrammarRulesClosure, getAllNTClosure } from "./utils";

export class DFABuilder {
  static build<
    T,
    After,
    Ctx extends BaseParserContext<T, After>,
    Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
    State extends BaseState<T, After, Ctx, Candidate, State>
  >(
    allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>,
    CandidateClass: CandidateClassCtor<T, After, Ctx, Candidate>,
    StateClass: StateClassCtor<T, After, Ctx, Candidate, State>
  ) {
    // init all initial candidates
    const allInitialCandidates = new Map<string, Candidate>();
    allGrammarRules.forEach((gr) => {
      const c = new CandidateClass({ gr, digested: 0 });
      allInitialCandidates.set(c.toString(), c);
    });

    const entryState = new StateClass(
      getGrammarRulesClosure(
        allGrammarRules.filter((gr) => entryNTs.has(gr.NT)),
        allGrammarRules
      ).map(
        (gr) =>
          // get initial candidate from global cache
          allInitialCandidates.get(
            BaseCandidate.getString({ gr, digested: 0 })
          )!
      )
    );
    const NTClosures = getAllNTClosure(NTs, allGrammarRules);

    // init all states
    const allStatesCache = new Map<string, State>();
    allStatesCache.set(entryState.toString(), entryState);

    // construct first sets for all NTs
    const firstSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => firstSets.set(NT, new GrammarSet())); // init
    NTClosures.forEach((grs, NT) => {
      const gs = firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.map((gr) => gs!.add(gr.rule[0]));
    });

    // construct follow sets for all NTs
    const followSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => followSets.set(NT, new GrammarSet())); // init
    allGrammarRules.map((gr) => {
      gr.rule.map((g, i, rule) => {
        if (i < rule.length - 1 && g.type == GrammarType.NT) {
          // current grammar is NT and next grammar exists, merge the NT's follow set with next grammar
          const gs = followSets.get(g.content)!;
          gs.add(rule[i + 1]);
          // if next grammar is also NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            firstSets.get(rule[i + 1].content)!.map((g) => gs.add(g));
        }
      });
    });
    // if the last grammar is NT, that NT's follow set should merge with the target NT's follow set, vice versa
    while (true) {
      let changed = false;

      allGrammarRules
        .filter((gr) => gr.rule.at(-1)!.type == GrammarType.NT) // last grammar if NT
        .map((gr) => {
          followSets
            .get(gr.NT)! // target NT's follow set
            .map(
              (g) =>
                (changed ||= followSets.get(gr.rule.at(-1)!.content)!.add(g))
            );
          followSets
            .get(gr.rule.at(-1)!.content)! // last grammar's follow set
            .map((g) => (changed ||= followSets.get(gr.NT)!.add(g)));
        });

      if (!changed) break;
    }

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
