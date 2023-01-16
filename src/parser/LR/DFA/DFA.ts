import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { Candidate } from "./candidate";
import { State } from "./state";
import { BaseDFA } from "../../base/DFA";
import { DFAClassCtor, GrammarRule, GrammarSet } from "../../base";
import { ParserContext } from "../model";

/** LR(1) DFA. Stateless. */
export class DFA<T> extends BaseDFA<
  T,
  ASTNode<T>[],
  ParserContext<T>,
  Candidate<T>,
  State<T>,
  DFA<T>
> {
  constructor(
    allGrammarRules: readonly GrammarRule<T, ASTNode<T>[], ParserContext<T>>[],
    entryNTs: ReadonlySet<string>,
    entryState: State<T>,
    NTClosures: ReadonlyMap<
      string,
      GrammarRule<T, ASTNode<T>[], ParserContext<T>>[]
    >,
    /** `NT => Grammars` */
    firstSets: ReadonlyMap<string, GrammarSet>,
    /** `NT => Grammars` */
    followSets: ReadonlyMap<string, GrammarSet>,
    /** string representation of candidate => candidate */
    allInitialCandidates: ReadonlyMap<string, Candidate<T>>,
    /** string representation of state => state */
    allStatesCache: Map<string, State<T>>,
    ChildClass: DFAClassCtor<
      T,
      ASTNode<T>[],
      ParserContext<T>,
      Candidate<T>,
      State<T>,
      DFA<T>
    >,
    stateStack?: State<T>[]
  ) {
    super(
      allGrammarRules,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStatesCache,
      ChildClass,
      stateStack
    );
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
}
