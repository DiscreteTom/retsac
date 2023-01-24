import { ASTNode } from "../../ast";
import { ParserOutput } from "../../model";
import { Candidate } from "./candidate";
import { State } from "./state";
import { BaseDFA } from "../../base/DFA";
import { GrammarSet } from "../../base";
import { LRParserContext } from "../model";
import { LRGrammarRule } from "../model/grammar";

/** LR(1) DFA. Stateless. */
export class DFA<T> extends BaseDFA<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>,
  Candidate<T>,
  State<T>
> {
  constructor(
    allGrammarRules: readonly LRGrammarRule<T>[],
    entryNTs: ReadonlySet<string>,
    entryState: State<T>,
    NTClosures: ReadonlyMap<string, LRGrammarRule<T>[]>,
    /** `NT => Grammars` */
    firstSets: ReadonlyMap<string, GrammarSet>,
    /** `NT => Grammars` */
    followSets: ReadonlyMap<string, GrammarSet>,
    /** string representation of candidate => candidate */
    allInitialCandidates: ReadonlyMap<string, Candidate<T>>,
    /** string representation of state => state */
    allStatesCache: Map<string, State<T>>
  ) {
    super(
      allGrammarRules,
      entryNTs,
      entryState,
      NTClosures,
      firstSets,
      followSets,
      allInitialCandidates,
      allStatesCache
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
      buffer = res.buffer.slice();
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
