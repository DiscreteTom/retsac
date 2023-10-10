import type { IStatelessLexer } from "../../../lexer";
import type { Logger } from "../../../logger";
import type { ParserBuilderData } from "../builder";
import type { GrammarRepo } from "../model";
import { GrammarRule, ReadonlyGrammarRuleRepo } from "../model";
import { CandidateRepo } from "./candidate";
import { StateRepo } from "./state";
import {
  getGrammarRulesClosure,
  getAllNTClosure,
  calculateAllStates,
  processDefinitions,
  buildFirstSets,
  buildFollowSets,
} from "./utils";

export class DFABuilder {
  static prepare<
    ASTData,
    ErrorType,
    Kinds extends string,
    LexerKinds extends string,
    LexerError,
  >(
    repo: GrammarRepo<Kinds, LexerKinds>,
    lexer: IStatelessLexer<LexerError, LexerKinds>,
    entryNTs: ReadonlySet<Kinds>,
    data: readonly Readonly<
      ParserBuilderData<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
    >[],
    printAll: boolean,
    logger: Logger,
  ) {
    const { tempGrammarRules, NTs, resolvedTemps } = processDefinitions(data);

    // transform temp grammar rules to grammar rules
    const grs = new ReadonlyGrammarRuleRepo(
      tempGrammarRules.map(
        (gr) =>
          new GrammarRule({
            NT: gr.NT,
            callback: gr.callback,
            rejecter: gr.rejecter,
            rollback: gr.rollback,
            commit: gr.commit,
            traverser: gr.traverser,
            rule: gr.rule.map((g) =>
              g.toGrammar(
                repo,
                lexer,
                printAll,
                logger,
                NTs.has(g.content as Kinds),
              ),
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
    const firstSets = buildFirstSets(NTs, NTClosures);
    const followSets = buildFollowSets(NTs, grs, firstSets);

    calculateAllStates(repo, grs, allStates, NTClosures, cs);

    return {
      grs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allStates,
      NTs,
      cs,
      resolvedTemps,
    };
  }
}
