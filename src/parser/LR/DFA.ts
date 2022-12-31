import { ASTNode } from "../ast";
import { ParserOutput } from "../model";
import { GrammarSet, GrammarType, ReducerContext } from "./model";
import { GrammarRule } from "./model";

/** A.k.a: LR(1) Project. */
export class Candidate<T> {
  readonly gr: GrammarRule<T>;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  /** `true` if already rejected and no need to check. */
  private rejected: boolean;

  constructor(data: Pick<Candidate<T>, "gr" | "digested">) {
    Object.assign(this, data);
    this.rejected = false;
  }

  /** Current grammar. */
  get current() {
    return this.gr.rule[this.digested];
  }

  canDigestMore() {
    return this.digested < this.gr.rule.length;
  }

  canAccept(node: ASTNode<T>) {
    return this.canDigestMore() && this.current.eq(node);
  }

  /** Generate next candidate with `digested + 1`. */
  next() {
    return new Candidate({ gr: this.gr, digested: this.digested + 1 });
  }

  /**
   * Only failed if:
   * 1. This grammar is already rejected.
   * 2. Digestion not finished.
   * 3. Check follow set failed.
   * 4. Rejecter rejected.
   */
  tryReduce(
    buffer: ASTNode<T>[],
    /** From where of the buffer to reduce. */
    index: number,
    entryNTs: Set<string>,
    followSets: Map<string, GrammarSet>,
    debug: boolean
  ): ParserOutput<T> {
    if (this.rejected || this.canDigestMore()) return { accept: false };

    const context: ReducerContext<T> = {
      matched: buffer.slice(index + 1 - this.gr.rule.length, index + 1),
      before: buffer.slice(0, index + 1 - this.gr.rule.length),
      after: buffer.slice(index + 1),
    };

    // peek next ASTNode and check follow for LR(1)
    if (context.after.length > 0) {
      if (entryNTs.has(this.gr.NT)) {
        // entry NT, no need to check follow set
        // e.g. when we parse `int a; int b;`, we don't need to check follow set for `;`
      } else if (!followSets.get(this.gr.NT).has(context.after[0])) {
        if (debug)
          console.log(
            `[Follow Mismatch] ${this.gr.toString()} follow=${context.after[0].toString()}`
          );
        return { accept: false };
      }
      // else, follow set matched, continue
    }

    // check rejecter
    if (this.gr.rejecter(context)) {
      this.rejected = true;
      if (debug) console.log(`[Reject] ${this.gr.toString()}`);
      return { accept: false };
    }

    // accept
    this.gr.callback(context);
    const node = new ASTNode({
      type: this.gr.NT,
      children: context.matched,
      data: context.data,
      error: context.error,
      start: context.matched[0].start,
    });
    node.children.map((c) => (c.parent = node)); // link parent
    if (debug) console.log(`[Accept] ${this.gr.toString()}`);

    return {
      accept: true,
      buffer: context.before.concat(node).concat(context.after),
      errors: context.error ? [node] : [],
    };
  }

  /** Return `NT <= ...before @ ...after`. */
  toString(sep = " ", arrow = "<=", index = "@") {
    return [
      this.gr.NT,
      arrow,
      ...this.gr.rule.slice(0, this.digested).map((r) => r.toString()),
      index,
      ...this.gr.rule.slice(this.digested).map((r) => r.toString()),
    ].join(sep);
  }
}

/** LR(1) state machine's state. */
export class State<T> {
  readonly candidates: Candidate<T>[];

  constructor(candidates: Candidate<T>[]) {
    this.candidates = candidates;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: ASTNode<T>[],
    /** From where of the buffer to reduce. */
    start: number,
    entryNTs: Set<string>,
    followSets: Map<string, GrammarSet>,
    debug: boolean
  ): ParserOutput<T> {
    for (const c of this.candidates) {
      const res = c.tryReduce(buffer, start, entryNTs, followSets, debug);
      if (res.accept) return res;
    }

    return { accept: false };
  }
}

/** LR(1) DFA. */
export class DFA<T> {
  private readonly NTClosures: Map<string, GrammarRule<T>[]>;
  private readonly entryState: State<T>;
  /** `NT => Grammars` */
  private readonly firstSets: Map<string, GrammarSet>;
  /** `NT => Grammars` */
  private readonly followSets: Map<string, GrammarSet>;
  private readonly entryNTs: Set<string>;
  /** Current state is `states.at(-1)`. */
  private stateStack: State<T>[];
  /** We will construct the state machine's state transition map on the fly. */
  private nextStateCache: Map<State<T>, { node: ASTNode<T>; next: State<T> }[]>;
  debug: boolean;

  constructor(
    allGrammarRules: GrammarRule<T>[],
    entryNTs: Set<string>,
    NTs: Set<string>
  ) {
    this.entryState = new State(
      getGrammarRulesClosure(
        allGrammarRules.filter((gr) => entryNTs.has(gr.NT)), // entry NT grammar rules
        allGrammarRules
      ).map((gr) => new Candidate({ gr, digested: 0 }))
    );
    this.NTClosures = getAllNTClosure(NTs, allGrammarRules);
    this.entryNTs = entryNTs;
    this.nextStateCache = new Map();
    this.nextStateCache.set(this.entryState, []); // init

    // construct first sets for all NTs
    this.firstSets = new Map();
    NTs.forEach((NT) => this.firstSets.set(NT, new GrammarSet())); // init
    this.NTClosures.forEach((grs, NT) => {
      const gs = this.firstSets.get(NT);
      // for each direct/indirect grammar rule, add first grammar to first set
      grs.map((gr) => gs.add(gr.rule[0]));
    });

    // construct follow sets for all NTs
    this.followSets = new Map();
    NTs.forEach((NT) => this.followSets.set(NT, new GrammarSet())); // init
    allGrammarRules.map((gr) => {
      gr.rule.map((g, i, rule) => {
        if (i < rule.length - 1 && g.type == GrammarType.NT) {
          // current grammar is NT and next grammar exists, merge the NT's follow set with next grammar
          const gs = this.followSets.get(g.content);
          gs.add(rule[i + 1]);
          // if next grammar is also NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            this.firstSets.get(rule[i + 1].content).map((g) => gs.add(g));
        }
      });
    });
    // if the last grammar is NT, that NT's follow set should merge with the target NT's follow set
    while (true) {
      let changed = false;

      allGrammarRules
        .filter((gr) => gr.rule.at(-1).type == GrammarType.NT) // last grammar if NT
        .map((gr) =>
          this.followSets
            .get(gr.NT) // target NT's follow set
            .map(
              (g) =>
                (changed ||= this.followSets.get(gr.rule.at(-1).content).add(g))
            )
        );

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
    let accept = false;
    const errors: ASTNode<T>[] = [];
    while (index < buffer.length) {
      // try to construct next state
      // first, try to get next state from cache
      let nextState = this.nextStateCache
        .get(this.stateStack.at(-1)) // current state
        ?.find(
          (c) =>
            // check ast node equality
            c.node.type == buffer[index].type &&
            c.node.text == buffer[index].text
        )?.next;
      // if not found in cache, construct next state and cache it
      if (!nextState) {
        const res = this.calculateNextState(
          this.stateStack.at(-1),
          buffer[index]
        );
        if (!res.accept) return { accept: false };

        nextState = res.state;
        // cache next state
        this.nextStateCache
          .get(this.stateStack.at(-1))
          .push({ next: nextState, node: buffer[index] });
        if (!this.nextStateCache.has(nextState))
          this.nextStateCache.set(nextState, []);
      }

      // push stack
      this.stateStack.push(nextState);

      // try reduce with the new state
      const res = this.stateStack
        .at(-1)
        .tryReduce(buffer, index, this.entryNTs, this.followSets, this.debug);
      if (!res.accept) {
        index++;
        continue; // try to digest more
      }

      // accepted
      const reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.concat(res.errors);
      accept = true;
      for (let i = 0; i < reduced; ++i) this.stateStack.pop(); // remove the reduced states
      // if a top-level NT is reduced, or stop on error, should return
      if (
        this.entryNTs.has(buffer[0].type) ||
        (stopOnError && errors.length > 0)
      )
        return { accept: true, buffer, errors };

      // continue loop, try to digest more with the newly reduced buffer
    }

    return accept ? { accept: true, buffer, errors } : { accept: false };
  }

  private calculateNextState(currentState: State<T>, next: ASTNode<T>) {
    const directCandidates = currentState.candidates
      .filter((c) => c.canAccept(next))
      .map((c) => c.next());
    const indirectCandidates = directCandidates
      .reduce((p, c) => {
        if (
          c.canDigestMore() &&
          c.current.type == GrammarType.NT &&
          !p.includes(c.current.content)
        )
          p.push(c.current.content);
        return p;
      }, [] as string[]) // de-duplicated NT list
      .reduce((p, c) => {
        this.NTClosures.get(c).map((gr) => {
          if (!p.includes(gr)) p.push(gr);
        });
        return p;
      }, [] as GrammarRule<T>[]) // de-duplicated GrammarRule list
      .map((gr) => new Candidate({ gr, digested: 0 }));
    const nextCandidates = directCandidates.concat(indirectCandidates);

    // if DFA can't accept input
    if (nextCandidates.length == 0) {
      if (this.debug)
        console.log(
          `[End] No more candidate. Node=${next.toString()} Candidates:\n${currentState.candidates
            .map((c) => c.toString())
            .join("\n")}`
        );
      return { accept: false };
    }
    return { accept: true, state: new State(nextCandidates) };
  }

  getFirstSets() {
    return this.firstSets;
  }
  getFollowSets() {
    return this.followSets;
  }
}

function getAllNTClosure<T>(
  NTs: Set<string>,
  allGrammarRules: GrammarRule<T>[]
): Map<string, GrammarRule<T>[]> {
  const result = new Map<string, GrammarRule<T>[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, allGrammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `X <= @ A`, we should also have `A <= @ B 'c'` and `B <= @ 'd'`.
 * In this case, `A <= @ B 'c'` and `B <= @ 'd'` are the closure of the NT 'A'.
 */
function getNTClosure<T>(
  NT: string,
  allGrammarRules: GrammarRule<T>[]
): GrammarRule<T>[] {
  return getGrammarRulesClosure(
    allGrammarRules.filter((gr) => gr.NT == NT),
    allGrammarRules
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 * E.g. knowing `A <= B 'c'` and `B <= 'd'`, we can infer `A <= 'd' 'c'`.
 * When we construct DFA state, if we have `A <= @ B 'c'`, we should also have `B <= @ 'd'`.
 */
function getGrammarRulesClosure<T>(
  rules: GrammarRule<T>[],
  allGrammarRules: GrammarRule<T>[]
): GrammarRule<T>[] {
  const result = [...rules];

  while (true) {
    let changed = false;
    result.map((gr) => {
      if (gr.rule[0].type == GrammarType.NT) {
        allGrammarRules
          .filter((gr2) => gr2.NT == gr.rule[0].content)
          .map((gr) => {
            if (result.includes(gr)) return;
            changed = true;
            result.push(gr);
          });
      }
    });

    if (!changed) break;
  }

  return result;
}
