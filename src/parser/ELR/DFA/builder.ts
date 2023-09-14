import type { ILexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ResolvedTempConflict, ParserBuilderData } from "../builder";
import type { GrammarRepo } from "../model";
import {
  GrammarRule,
  ReadonlyGrammarRuleRepo,
  GrammarSet,
  GrammarType,
} from "../model";
import { CandidateRepo } from "./candidate";
import type {
  FirstSets,
  FollowSets,
  ReadonlyFirstSets,
  ReadonlyFollowSets,
} from "./first-follow-sets";
import { StateRepo } from "./state";
import {
  getGrammarRulesClosure,
  getAllNTClosure,
  calculateAllStates,
  processDefinitions,
} from "./utils";

export class DFABuilder {
  static prepare<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    repo: GrammarRepo<Kinds | LexerKinds>,
    lexer: ILexer<unknown, LexerKinds>,
    entryNTs: ReadonlySet<string>,
    data: ParserBuilderData<ASTData, ErrorType, Kinds, LexerKinds>,
    resolvedTemp: ResolvedTempConflict<ASTData, ErrorType, Kinds, LexerKinds>[],
    printAll: boolean,
    logger: Logger,
  ) {
    // transform definitions to temp grammar rules
    // and append resolved conflicts defined in definition context in data into resolvedTemp
    const { tempGrammarRules, NTs, allResolvedTemp } = processDefinitions<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds
    >(data, resolvedTemp);

    // transform temp grammar rules to grammar rules
    const grs = new ReadonlyGrammarRuleRepo(
      tempGrammarRules.map(
        (gr) =>
          new GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>({
            NT: gr.NT,
            callback: gr.callback,
            rejecter: gr.rejecter,
            rollback: gr.rollback,
            commit: gr.commit,
            traverser: gr.traverser,
            rule: gr.rule.map((g) =>
              g.toGrammar(repo, lexer, printAll, logger, NTs.has(g.content)),
            ),
            hydrationId: gr.hydrationId,
          }),
      ),
    );

    // init all initial candidates, initial candidate is candidate with digested=0
    const cs = new CandidateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >();
    grs.grammarRules.forEach((gr) => {
      cs.addInitial(gr);
    });

    const entryCandidates = getGrammarRulesClosure(
      // find those grammar rules which can reduce to entry NTs
      grs.filter((gr) => entryNTs.has(gr.NT)),
      grs,
    ).map(
      (gr) =>
        // find candidate corresponding to the grammar rule
        cs.getInitial(gr)!,
    );

    // init all states
    const allStates = new StateRepo<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >();
    const entryState = allStates.addEntry(entryCandidates)!;

    const NTClosures = getAllNTClosure(NTs, grs);

    // construct first sets for all NTs
    const firstSets = new Map<
      string,
      GrammarSet<Kinds | LexerKinds>
    >() as FirstSets<Kinds | LexerKinds>;
    NTs.forEach((NT) => firstSets.set(NT, new GrammarSet())); // init
    NTClosures.forEach((grs, NT) => {
      const gs = firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.forEach((gr) => gs!.add(gr.rule[0]));
    });

    // construct follow sets for all grammars
    const followSets = new Map<
      string,
      GrammarSet<Kinds | LexerKinds>
    >() as FollowSets<Kinds | LexerKinds>;
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
          if (rule[i + 1].type == GrammarType.NT)
            firstSets.get(rule[i + 1].kind)!.grammars.forEach((g) => gs.add(g));
        }
      });
    });
    // the last grammar's follow set should merge with the target NT's follow set, vice versa
    while (true) {
      let changed = false;

      grs.grammarRules.forEach((gr) => {
        followSets
          .get(gr.NT)! // target NT's follow set
          .grammars.forEach(
            (g) => (changed ||= followSets.get(gr.rule.at(-1)!.kind)!.add(g)),
          );
        followSets
          .get(gr.rule.at(-1)!.kind)! // last grammar's follow set
          .grammars.forEach((g) => (changed ||= followSets.get(gr.NT)!.add(g)));
      });

      if (!changed) break;
    }

    calculateAllStates(repo, grs, allStates, NTClosures, cs);

    return {
      grs,
      entryNTs,
      entryState,
      NTClosures,
      firstSets: firstSets as ReadonlyFirstSets<Kinds | LexerKinds>,
      followSets: followSets as ReadonlyFollowSets<Kinds | LexerKinds>,
      allStates,
      NTs,
      cs,
      allResolvedTemp,
    };
  }
}
