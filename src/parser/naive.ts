import { ASTNode } from "./ast";
import { Token } from "../lexer/lexer";

export enum ConflictType {
  RR, // reduce/reduce
  SR, // shift/reduce
}

export type GrammarRule = {
  rule: string[]; // a list of Ts and NTs
  NT: string; // the reduce target
  priority: number; // priority when conflict, default: -1
  conflicts: { rule: GrammarRule; type: ConflictType; lookahead?: number }[]; // conflict rules with higher priority
};

export class NaiveLR {
  private grammarRules: GrammarRule[];
  private buffer: (Token | ASTNode)[];
  private index: number;

  constructor(grammarRules: GrammarRule[]) {
    this.grammarRules = grammarRules;
    this.buffer = [];
    this.index = 1;
  }

  reset() {
    this.buffer = [];
    this.index = 1;
    return this;
  }

  getBuffer() {
    return this.buffer;
  }

  feed(tokens: Token[]) {
    this.buffer.push(...tokens);

    while (this.index <= this.buffer.length) {
      // traverse all grammars, try to reduce
      let reduced = false;
      for (const g of this.grammarRules) {
        if (this.tryReduce(g)) {
          // reduce successful
          reduced = true;
          break; // traverse all grammars again
        }
      }

      if (!reduced) {
        // can't reduce more
        this.index++; // try to look more
      }
      // else, traverse again
    }

    return this;
  }

  /**
   * Try to reduce `buffer.slice(0, this.index)` with the given grammar rule.
   * Return `true` means successfully reduce.
   */
  private tryReduce(g: GrammarRule) {
    if (g.rule.length > this.index) return false;

    // get buffer tail with the same length of grammar rule
    let tail = this.buffer.slice(this.index - g.rule.length, this.index);

    // check whether buffer tail match grammar
    for (let i = 0; i < tail.length; i++) {
      if (tail[i].type != g.rule[i]) return false;
    }

    // buffer tail match grammar, check conflicts, higher priority first
    for (const c of g.conflicts) {
      if (c.type == ConflictType.RR) {
        // reduce/reduce conflict
        // just try to reduce
        if (this.tryReduce(c.rule))
          // conflict can reduce
          return true;
      } else {
        // shift/reduce conflict
        // need lookahead
        for (let i = 1; i <= c.lookahead; i++) {
          if (this.index + i > this.buffer.length)
            // buffer not long enough to lookahead
            break;

          this.index += i; // move index to lookahead
          if (this.tryReduce(c.rule))
            // conflict can reduce
            return true;
          this.index -= i; // restore index
        }
      }
    }
    // all conflict can not reduce

    // reduce, generate tree
    let node = new ASTNode({
      children: [],
      parent: null,
      type: g.NT,
    });
    node.children = tail.map((t) => {
      if (t instanceof ASTNode) {
        t.parent = node;
        return t;
      } else {
        return new ASTNode({
          children: [],
          parent: node,
          text: t.content,
          type: t.type,
        });
      }
    });

    // update buffer
    this.buffer = this.buffer
      .slice(0, this.index - g.rule.length) // un-reduced part
      .concat(node) // reduce result
      .concat(this.buffer.slice(this.index)); // un-reduced part
    this.index -= tail.length - 1;

    return true;
  }
}
