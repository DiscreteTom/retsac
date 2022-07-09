import { ASTNode } from "../ast";
import { ParserOutput } from "../model";
import { GrammarSet, GrammarType, ReducerContext } from "./model";
import { GrammarRule } from "./model";

/** A.k.a: LR(1) Project. */
export class Candidate {
  readonly gr: GrammarRule;
  /** How many grammars are already matched in `this.gr`. */
  readonly digested: number;
  /** `true` if already rejected and no need to check. */
  private rejected: boolean;

  constructor(data: Pick<Candidate, "gr" | "digested">) {
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

  canAccept(node: ASTNode) {
    return this.canDigestMore() && this.current.eq(node);
  }

  private canReduce() {
    return !this.canDigestMore() && !this.rejected;
  }

  /** Generate next candidate with `digested + 1`. */
  next() {
    return new Candidate({ gr: this.gr, digested: this.digested + 1 });
  }

  tryReduce(
    buffer: ASTNode[],
    /** From where of the buffer to reduce. */
    index: number,
    entryNTs: Set<string>,
    follow: Map<string, GrammarSet>,
    debug: boolean
  ): ParserOutput {
    if (!this.canReduce()) return { accept: false };

    let context: ReducerContext = {
      matched: buffer.slice(index + 1 - this.gr.rule.length, index + 1),
      before: buffer.slice(0, index + 1 - this.gr.rule.length),
      after: buffer.slice(index + 1),
      data: { value: null },
      error: null,
    };

    // check follow for LR(1)
    if (context.after.length > 0 && !entryNTs.has(this.gr.NT)) {
      if (!follow.get(this.gr.NT).has(context.after[0])) {
        if (debug)
          console.log(
            `[Follow Mismatch] ${this.gr.toString()} follow=${context.after[0].toString()}`
          );
        return { accept: false };
      }
    }

    // check rejecter
    if (this.gr.rejecter(context)) {
      this.rejected = true;
      if (debug) console.log(`[Reject] ${this.gr.toString()}`);
      return { accept: false };
    }

    // accept
    this.gr.callback(context);
    let node = new ASTNode({
      type: this.gr.NT,
      children: context.matched,
      data: context.data,
      error: context.error,
      start: context.matched[0].start,
    });
    node.children.map((c) => (c.parent = node));
    if (debug) console.log(`[Accept] ${this.gr.toString()}`);

    return {
      accept: true,
      buffer: context.before.concat(node).concat(context.after),
      errors: context.error ? [node] : [],
    };
  }

  /** Return `NT => ...before @ ...after`. */
  toString(sep = " ", arrow = "=>", index = "@") {
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
export class State {
  readonly candidates: Candidate[];

  constructor(candidates: Candidate[]) {
    this.candidates = candidates;
  }

  /** Traverse all candidates to try to reduce. */
  tryReduce(
    buffer: ASTNode[],
    /** From where of the buffer to reduce. */
    start: number,
    entryNTs: Set<string>,
    follow: Map<string, GrammarSet>,
    debug: boolean
  ): ParserOutput {
    for (const c of this.candidates) {
      let res = c.tryReduce(buffer, start, entryNTs, follow, debug);
      if (res.accept) return res;
    }

    return { accept: false };
  }
}

/** LR(1) DFA. */
export class DFA {
  private readonly NTClosures: Map<string, GrammarRule[]>;
  private readonly entryState: State;
  /** `NT => Grammars` */
  private readonly first: Map<string, GrammarSet>;
  /** `NT => Grammars` */
  private readonly follow: Map<string, GrammarSet>;
  private readonly entryNTs: Set<string>;
  /** State stack, current state is `states[-1]`. */
  private states: State[];
  debug: boolean;

  constructor(
    grammarRules: GrammarRule[],
    entryNTs: Set<string>,
    NTs: Set<string>
  ) {
    this.entryState = new State(
      getGrammarRulesClosure(
        grammarRules.filter((gr) => entryNTs.has(gr.NT)), // entry NT grammar rules
        grammarRules
      ).map((gr) => new Candidate({ gr, digested: 0 }))
    );
    this.NTClosures = getAllNTClosure(NTs, grammarRules);
    this.entryNTs = entryNTs;

    // construct first
    this.first = new Map();
    NTs.forEach((NT) => this.first.set(NT, new GrammarSet()));
    this.NTClosures.forEach((grs, NT) => {
      let gs = this.first.get(NT);
      grs.map((gr) => gs.add(gr.rule[0]));
    });

    // construct follow
    this.follow = new Map();
    NTs.forEach((NT) => this.follow.set(NT, new GrammarSet()));
    grammarRules.map((gr) => {
      gr.rule.map((g, i, rule) => {
        if (i < rule.length - 1 && g.type == GrammarType.NT) {
          // current grammar is NT and next grammar exists, merge with next grammar
          let gs = this.follow.get(g.content);
          gs.add(rule[i + 1]);
          // if next grammar is NT, merge with its first set
          if (rule[i + 1].type == GrammarType.NT)
            this.first.get(rule[i + 1].content).map((g) => gs.add(g));
        }
      });
    });
    // if the last grammar is NT, that NT's follow set should merge with the target NT's follow set
    while (true) {
      let changed = false;

      grammarRules
        .filter((gr) => gr.rule.at(-1).type == GrammarType.NT) // last grammar if NT
        .map((gr) =>
          this.follow
            .get(gr.NT) // target NT's follow set
            .map(
              (g) =>
                (changed ||= this.follow.get(gr.rule.at(-1).content).add(g))
            )
        );

      if (!changed) break;
    }

    this.reset();
  }

  reset() {
    // reset state stack with entry state
    this.states = [this.entryState];
  }

  parse(buffer: ASTNode[]): ParserOutput {
    this.reset();

    let index = 0; // buffer index
    let errors: ASTNode[] = [];
    let accept = false;
    while (index < buffer.length) {
      // try to construct next state
      let directCandidates = this.states
        .at(-1)
        .candidates.filter((c) => c.canAccept(buffer[index]))
        .map((c) => c.next());
      let indirectCandidates = directCandidates
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
        }, [] as GrammarRule[]) // de-duplicated GrammarRule list
        .map((gr) => new Candidate({ gr, digested: 0 }));
      let nextCandidates = directCandidates.concat(indirectCandidates);

      // if DFA can't accept input
      if (nextCandidates.length == 0) {
        if (this.debug)
          console.log(
            `[End] No more candidate. Node=${buffer[
              index
            ].toString()} Candidates:\n${this.states
              .at(-1)
              .candidates.map((c) => c.toString())
              .join("\n")}`
          );
        return { accept: false };
      }

      // construct new state and push stack
      this.states.push(new State(nextCandidates));

      // try reduce with the new state
      let res = this.states
        .at(-1)
        .tryReduce(buffer, index, this.entryNTs, this.follow, this.debug);
      if (!res.accept) {
        index++;
        continue; // continue shift
      }

      // accept
      let reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.concat(res.errors);
      accept = true;
      for (let i = 0; i < reduced; ++i) this.states.pop(); // remove the reduced states
      // if a top-level NT is reduced, should return
      if (this.entryNTs.has(buffer[0].type))
        return { accept: true, buffer, errors };
    }

    return accept ? { accept: true, buffer, errors } : { accept: false };
  }
}

function getAllNTClosure(
  NTs: Set<string>,
  grammarRules: GrammarRule[]
): Map<string, GrammarRule[]> {
  let result = new Map<string, GrammarRule[]>();
  NTs.forEach((NT) => result.set(NT, getNTClosure(NT, grammarRules)));
  return result;
}

/**
 * Get all direct/indirect grammar rules which can reduce to the specified NT.
 */
function getNTClosure(NT: string, grammarRules: GrammarRule[]): GrammarRule[] {
  return getGrammarRulesClosure(
    grammarRules.filter((gr) => gr.NT == NT),
    grammarRules
  );
}

/**
 * If a rule starts with NT, merge result with that NT's grammar rules.
 */
function getGrammarRulesClosure(
  rules: GrammarRule[],
  grammarRules: GrammarRule[]
): GrammarRule[] {
  let result = [...rules];

  while (true) {
    let changed = false;
    result.map((gr) => {
      if (gr.rule[0].type == GrammarType.NT) {
        grammarRules
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
