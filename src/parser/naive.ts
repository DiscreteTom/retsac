import { ASTNode } from "./ast";
import { Token } from "../lexer/lexer";

export type Grammar = {
  rule: string[]; // a list of Ns and NTs
  type: string; // name of T or NT
};

export class NaiveLR {
  private grammars: Grammar[];
  private buffer: (Token | ASTNode)[];

  constructor(grammars: Grammar[]) {
    this.grammars = grammars;
    this.buffer = [];
  }

  reset() {
    this.buffer = [];
    return this;
  }

  getBuffer() {
    return this.buffer;
  }

  feedOne(t: Token) {
    this.buffer.push(t);

    while (true) {
      // traverse all grammars, try to reduce
      let reduced = false;
      for (const g of this.grammars) {
        if (this.tryReduce(g)) {
          // reduce successful
          reduced = true;
          break;
        }
      }

      if (!reduced) {
        // can't reduce more
        break;
      }
      // else, traverse again
    }

    return this;
  }

  /**
   * Return `true` means successfully reduce.
   */
  private tryReduce(grammar: Grammar) {
    if (grammar.rule.length > this.buffer.length) return false;

    let tail = this.buffer.slice(-grammar.rule.length);

    // check whether tail match grammar
    for (let i = 0; i < tail.length; i++) {
      if (tail[i].type != grammar.rule[i]) return false;
    }

    // reduce, generate tree
    let node = new ASTNode({
      children: [],
      parent: null,
      type: grammar.type,
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
    this.buffer = this.buffer.slice(0, -tail.length); // reduce
    this.buffer.push(node);

    return true;
  }
}
