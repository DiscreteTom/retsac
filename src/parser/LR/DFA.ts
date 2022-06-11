import { ASTNode } from "../ast";
import { ParserOutput } from "../model";
import { ReducerContext } from "./model";
import { GrammarRule } from "./model";

/** A.k.a: Project. */
export class Candidate {
  readonly gr: GrammarRule;
  readonly digested: number;

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

  next() {
    return new Candidate({ gr: this.gr, digested: this.digested + 1 });
  }

  tryReduce(buffer: ASTNode[], index: number): ParserOutput {
    if (this.canDigestMore() || this.rejected) return { accept: false };

    let context: ReducerContext = {
      matched: buffer.slice(index + 1 - this.gr.rule.length, index + 1),
      before: buffer.slice(0, index + 1 - this.gr.rule.length),
      after: buffer.slice(index + 1),
      data: { value: null },
      error: "",
    };
    if (this.gr.rejecter(context)) {
      this.rejected = true;
      return { accept: false };
    }

    // accept
    this.gr.callback(context);
    let node = new ASTNode({
      type: this.gr.NT,
      children: context.matched,
      data: context.data,
      error: context.error,
    });
    node.children.map((c) => (c.parent = node));
    return {
      accept: true,
      buffer: context.before.concat(node).concat(context.after),
      errors: context.error ? [node] : [],
    };
  }
}

export class State {
  readonly candidates: Candidate[];

  constructor(candidates: Candidate[]) {
    this.candidates = candidates;
  }

  tryReduce(buffer: ASTNode[], start: number): ParserOutput {
    for (const c of this.candidates) {
      let res = c.tryReduce(buffer, start);
      if (res.accept) return res;
    }

    return { accept: false };
  }
}

export class DFA {
  private states: State[]; // state stack, current state is states[-1]
  private NTClosures: Map<string, GrammarRule[]>;
  private entryState: State;

  constructor(
    grammarRules: GrammarRule[],
    entryNTs: Set<string>,
    NTs: Set<string>
  ) {
    this.entryState = new State(
      getGrammarRulesClosure(
        grammarRules.filter((gr) => entryNTs.has(gr.NT)),
        grammarRules
      ).map((gr) => new Candidate({ gr, digested: 0 }))
    );
    this.NTClosures = getAllNTClosure(NTs, grammarRules);
  }

  reset() {
    // reset state with entry state
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
            c.current.type == "NT" &&
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

      // DFA can't accept input
      if (nextCandidates.length == 0) return { accept: false };

      // construct new state and push stack
      this.states.push(new State(nextCandidates));

      // try reduce with the new state
      let res = this.states.at(-1).tryReduce(buffer, index);
      if (!res.accept) {
        index++;
        continue; // continue shift
      }

      let reduced = buffer.length - res.buffer.length + 1; // how many nodes are digested
      index -= reduced - 1; // digest n, generate 1
      buffer = res.buffer;
      errors.concat(res.errors);
      accept = true;
      for (let i = 0; i < reduced; ++i) this.states.pop(); // remove the reduced states
    }

    return accept ? { accept, buffer, errors } : { accept: false };
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
      if (gr.rule[0].type == "NT") {
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
