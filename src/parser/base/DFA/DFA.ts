import { ILexer } from "../../../lexer";
import {
  BaseParserContext,
  CandidateClassCtor,
  GrammarRule,
  GrammarSet,
  GrammarType,
  StateClassCtor,
} from "../model";
import { BaseCandidate } from "./candidate";
import { BaseState } from "./state";
import { getGrammarRulesClosure, getAllNTClosure } from "./utils";

/** Base DFA for LR and ELR parsers. Stateless. */
export class BaseDFA<
  T,
  After,
  Ctx extends BaseParserContext<T, After>,
  Candidate extends BaseCandidate<T, After, Ctx, Candidate>,
  State extends BaseState<T, After, Ctx, Candidate, State>
> {
  /** Current state is `states.at(-1)`. */
  protected stateStack: State[];
  debug: boolean;

  constructor(
    protected readonly allGrammarRules: readonly GrammarRule<T, After, Ctx>[],
    protected readonly entryNTs: ReadonlySet<string>,
    private readonly entryState: State,
    protected readonly NTClosures: ReadonlyMap<
      string,
      GrammarRule<T, After, Ctx>[]
    >,
    /** `NT => Grammars` */
    private readonly firstSets: ReadonlyMap<string, GrammarSet>,
    /** `NT => Grammars` */
    protected readonly followSets: ReadonlyMap<string, GrammarSet>,
    /** string representation of candidate => candidate */
    protected readonly allInitialCandidates: ReadonlyMap<string, Candidate>,
    /** string representation of state => state */
    protected readonly allStatesCache: Map<string, State>
  ) {
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
   * Calculate state machine's state transition map ahead of time and cache.
   * This action requires a lexer to calculate literal's type name.
   * If you don't use literal grammar in your rules, you can omit the lexer.
   */
  calculateAllStates(lexer?: ILexer) {
    // collect all grammars in rules
    const gs = new GrammarSet();
    this.allGrammarRules.forEach((gr) => {
      gr.rule.forEach((g) => {
        gs.add(g);
      });
    });
    // convert to mock AST node
    const mockNodes = gs.map((g) => g.toASTNode<T>(lexer));

    while (true) {
      let changed = false;
      this.allStatesCache.forEach((state) => {
        mockNodes.forEach((node) => {
          if (
            state.getNext(
              node,
              this.NTClosures,
              this.allStatesCache,
              this.allInitialCandidates
            ).changed
          )
            changed = true;
        });
      });
      if (!changed) break;
    }
    return this;
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
