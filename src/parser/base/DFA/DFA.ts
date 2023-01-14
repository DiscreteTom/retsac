import {
  BaseParserContext,
  GrammarRule,
  GrammarSet,
  GrammarType,
} from "../model";
import { BaseCandidate } from "./candidate";
import { BaseState } from "./state";
import { getGrammarRulesClosure, getAllNTClosure } from "./utils";

/** Base DFA for LR and ELR parsers. Stateless. */
export class BaseDFA<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx>,
  State extends BaseState<T, After, Ctx, Candidate>
> {
  protected readonly allGrammarRules: readonly GrammarRule<T, After, Ctx>[];
  protected readonly NTClosures: Map<string, GrammarRule<T, After, Ctx>[]>;
  private readonly entryState: State;
  /** `NT => Grammars` */
  private readonly firstSets: Map<string, GrammarSet>;
  /** `NT => Grammars` */
  protected readonly followSets: Map<string, GrammarSet>;
  protected readonly entryNTs: ReadonlySet<string>;
  /** Current state is `states.at(-1)`. */
  protected stateStack: State[];
  /** string representation of state => state */
  protected allStatesCache: Map<string, State>;
  /** string representation of candidate => candidate */
  protected allInitialCandidates: Map<string, Candidate>;
  debug: boolean;

  constructor(
    allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>,
    CandidateClass: new (props: {
      gr: GrammarRule<T, After, Ctx>;
      digested: number;
    }) => Candidate,
    StateClass: new (candidates: Candidate[]) => State
  ) {
    this.allGrammarRules = allGrammarRules;
    this.entryNTs = entryNTs;

    // init all initial candidates
    this.allInitialCandidates = new Map();
    this.allGrammarRules.forEach((gr) => {
      const c = new CandidateClass({ gr, digested: 0 });
      this.allInitialCandidates.set(c.toString(), c);
    });

    this.entryState = new StateClass(
      getGrammarRulesClosure(
        allGrammarRules.filter((gr) => entryNTs.has(gr.NT)),
        allGrammarRules
      ).map(
        (gr) =>
          // get initial candidate from global cache
          this.allInitialCandidates.get(
            BaseCandidate.getString({ gr, digested: 0 })
          )!
      )
    );
    this.NTClosures = getAllNTClosure(NTs, allGrammarRules);

    // init all states
    this.allStatesCache = new Map();
    this.allStatesCache.set(this.entryState.toString(), this.entryState);

    // construct first sets for all NTs
    this.firstSets = new Map();
    NTs.forEach((NT) => this.firstSets.set(NT, new GrammarSet())); // init
    this.NTClosures.forEach((grs, NT) => {
      const gs = this.firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.map((gr) => gs!.add(gr.rule[0]));
    });

    // construct follow sets for all NTs
    this.followSets = new Map();
    NTs.forEach((NT) => this.followSets.set(NT, new GrammarSet())); // init
    allGrammarRules.map((gr) => {
      gr.rule.map((g, i, rule) => {
        if (i < rule.length - 1 && g.type == GrammarType.NT) {
          // current grammar is NT and next grammar exists, merge the NT's follow set with next grammar
          const gs = this.followSets.get(g.content)!;
          gs.add(rule[i + 1]);
          // if next grammar is also NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            this.firstSets.get(rule[i + 1].content)!.map((g) => gs.add(g));
        }
      });
    });
    // if the last grammar is NT, that NT's follow set should merge with the target NT's follow set, vice versa
    while (true) {
      let changed = false;

      allGrammarRules
        .filter((gr) => gr.rule.at(-1)!.type == GrammarType.NT) // last grammar if NT
        .map((gr) => {
          this.followSets
            .get(gr.NT)! // target NT's follow set
            .map(
              (g) =>
                (changed ||= this.followSets
                  .get(gr.rule.at(-1)!.content)!
                  .add(g))
            );
          this.followSets
            .get(gr.rule.at(-1)!.content)! // last grammar's follow set
            .map((g) => (changed ||= this.followSets.get(gr.NT)!.add(g)));
        });

      if (!changed) break;
    }

    this.reset();
  }

  reset() {
    // reset state stack with entry state
    this.stateStack = [this.entryState];
  }

  getFirstSets() {
    return this.firstSets;
  }
  getFollowSets() {
    return this.followSets;
  }

  /**
   * Return all cached states. You might want to call `calculateAllState` first.
   */
  getAllStates() {
    const result: State[] = [];
    this.allStatesCache.forEach((s) => result.push(s));
    return result;
  }
}
