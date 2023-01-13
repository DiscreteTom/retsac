import { ILexer } from "../../../lexer/model";
import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { GrammarRule, GrammarSet, GrammarType } from "../model";
import { Candidate } from "./candidate";
import { State } from "./state";
import { getGrammarRulesClosure, getAllNTClosure } from "./utils";
import { LR_RuntimeError } from "./../error";

/** LR(1) DFA. */
export class DFA<T> {
  private readonly allGrammarRules: readonly GrammarRule<T>[];
  private readonly NTClosures: Map<string, GrammarRule<T>[]>;
  private readonly entryState: State<T>;
  /** `NT => Grammars` */
  private readonly firstSets: Map<string, GrammarSet>;
  /** `NT => Grammars` */
  private readonly followSets: Map<string, GrammarSet>;
  private readonly entryNTs: ReadonlySet<string>;
  /** Current state is `states.at(-1)`. */
  private stateStack: State<T>[];
  /** string representation of state => state */
  private allStatesCache: Map<string, State<T>>;
  /** string representation of candidate => candidate */
  private allInitialCandidates: Map<string, Candidate<T>>;
  debug: boolean;

  constructor(
    allGrammarRules: readonly GrammarRule<T>[],
    entryNTs: ReadonlySet<string>,
    NTs: ReadonlySet<string>
  ) {
    this.allGrammarRules = allGrammarRules;
    this.entryNTs = entryNTs;

    // init all initial candidates
    this.allInitialCandidates = new Map();
    this.allGrammarRules.forEach((gr) => {
      const c = new Candidate({ gr, digested: 0 });
      this.allInitialCandidates.set(c.toString(), c);
    });

    this.entryState = new State(
      getGrammarRulesClosure(
        allGrammarRules.filter((gr) => entryNTs.has(gr.NT)), // entry NT grammar rules
        allGrammarRules
      ).map(
        (gr) =>
          // get initial candidate from global cache
          this.allInitialCandidates.get(
            Candidate.getString({ gr, digested: 0 })
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

  /** Reset DFA then try to yield an entry NT. */
  parse(buffer: ASTNode<T>[], stopOnError = false): ParserOutput<T> {
    this.reset();

    let index = 0; // buffer index
    const errors: ASTNode<T>[] = [];
    while (index < buffer.length) {
      // try to construct next state
      const nextStateResult = this.stateStack
        .at(-1)!
        .getNext(
          buffer[index],
          this.NTClosures,
          this.allStatesCache,
          this.allInitialCandidates
        );
      if (nextStateResult.state == null) {
        if (this.debug)
          console.log(
            `[End] No more candidate. Node=${buffer[
              index
            ].toString()} Candidates:\n${this.stateStack
              .at(-1)!
              .candidates.map((c) => c.toString())
              .join("\n")}`
          );
        return { accept: false };
      }

      // push stack
      this.stateStack.push(nextStateResult.state);

      // try reduce with the new state
      const res = this.stateStack
        .at(-1)!
        .tryReduce(buffer, index, this.entryNTs, this.followSets, this.debug);
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      const reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.push(...res.errors);
      for (let i = 0; i < reduced; ++i) this.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced to the head of the buffer, should return
      if (this.entryNTs.has(buffer[0].type) && index == 0)
        return { accept: true, buffer, errors };
      // if stop on error, return partial result
      if (stopOnError && errors.length > 0)
        return { accept: true, buffer, errors };

      // continue loop, try to digest more with the newly reduced buffer
    }

    // index == buffer.length, maybe need more input
    return { accept: false };
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
    const result: State<T>[] = [];
    this.allStatesCache.forEach((s) => result.push(s));
    return result;
  }
}
