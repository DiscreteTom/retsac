import { ILexer } from "../../../lexer";
import {
  TempGrammarRule,
  ResolvedTempConflict,
  ParserBuilderData,
} from "../builder";
import { defToTempGRs } from "../builder/utils/definition";
import {
  ConflictType,
  GrammarRepo,
  GrammarRule,
  GrammarSet,
  GrammarType,
} from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";
import {
  getGrammarRulesClosure,
  getAllNTClosure,
  calculateAllStates,
  processDefinitions,
} from "./utils";

export class DFABuilder {
  static build<T>(
    repo: GrammarRepo,
    lexer: ILexer<any>,
    entryNTs: ReadonlySet<string>,
    data: ParserBuilderData<T>,
    resolvedTemp: ResolvedTempConflict<T>[]
  ) {
    const { tempGrammarRules, NTs } = processDefinitions<T>(data, resolvedTemp);

    // transform temp grammar rules to grammar rules
    const grs = tempGrammarRules.map(
      (gr) =>
        new GrammarRule<T>({
          NT: gr.NT,
          callback: gr.callback ?? (() => {}),
          rejecter: gr.rejecter ?? (() => false),
          rollback: gr.rollback ?? (() => {}),
          commit: gr.commit ?? (() => false),
          traverser: gr.traverser,
          rule: gr.rule.map((g) => g.toGrammar(repo, NTs.has(g.content))),
        })
    );

    // init all initial candidates, initial candidate is candidate with digested=0
    const allInitialCandidates = new Map<string, Candidate<T>>();
    grs.forEach((gr) => {
      const c = new Candidate<T>({ gr, digested: 0 });
      allInitialCandidates.set(c.toString(), c); // TODO: use toStringWithName?
    });

    const entryCandidates = getGrammarRulesClosure(
      grs.filter((gr) => entryNTs.has(gr.NT)),
      grs
    ).map(
      (gr) =>
        // get initial candidate from global cache
        allInitialCandidates.get(Candidate.getString({ gr, digested: 0 }))!
    );
    const entryState = new State<T>(
      entryCandidates,
      State.getString({ candidates: entryCandidates })
    );
    const NTClosures = getAllNTClosure(NTs, grs);

    // init all states
    const allStates = new Map<string, State<T>>();
    allStates.set(entryState.toString(), entryState);

    // construct first sets for all NTs
    const firstSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => firstSets.set(NT, new GrammarSet())); // init
    NTClosures.forEach((grs, NT) => {
      const gs = firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.forEach((gr) => gs!.add(gr.rule[0]));
    });

    // construct follow sets for all grammars
    const followSets = new Map<string, GrammarSet>();
    NTs.forEach((NT) => followSets.set(NT, new GrammarSet())); // init for all NTs
    grs.forEach((gr) => {
      gr.rule.forEach((g, i, rule) => {
        if (!followSets.has(g.kind)) {
          // if g is a T/Literal, it might not have a follow set
          followSets.set(g.kind, new GrammarSet());
        }
        if (i < rule.length - 1) {
          // next grammar exists, merge the current grammar's follow set with next grammar
          const gs = followSets.get(g.kind)!;
          gs.add(rule[i + 1]);
          // if next grammar is also NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            firstSets.get(rule[i + 1].kind)!.grammars.forEach((g) => gs.add(g));
        }
      });
    });
    // the last grammar's follow set should merge with the target NT's follow set, vice versa
    while (true) {
      let changed = false;

      grs.forEach((gr) => {
        followSets
          .get(gr.NT)! // target NT's follow set
          .grammars.forEach(
            (g) => (changed ||= followSets.get(gr.rule.at(-1)!.kind)!.add(g))
          );
        followSets
          .get(gr.rule.at(-1)!.kind)! // last grammar's follow set
          .grammars.forEach((g) => (changed ||= followSets.get(gr.NT)!.add(g)));
      });

      if (!changed) break;
    }

    calculateAllStates(lexer, grs, allStates, NTClosures, allInitialCandidates);

    return {
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStates,
      NTs,
      tempGrammarRules,
    };
  }
}
