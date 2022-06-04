import { Lexer } from "../lexer/lexer";
import { ASTData, ASTNode } from "./ast";

export type NodeReducerOutput =
  | { accept: false }
  | {
      accept: true;
      digested: number; // how many nodes are digested
      type: string; // NT type
      data: ASTData;
      error: string; // empty if no error
    };

export type NodeReducerExec = (
  buffer: ASTNode[],
  rest: ASTNode[]
) => NodeReducerOutput;

export class NodeReducer {
  reduce: NodeReducerExec;

  constructor(exec: NodeReducerExec) {
    this.reduce = exec;
  }
}

export class Parser {
  private reducers: NodeReducer[];
  private lexer: Lexer;
  private buffer: ASTNode[];
  private errors: ASTNode[];

  constructor(lexer?: Lexer) {
    this.reducers = [];
    this.buffer = [];
    this.errors = [];
    this.lexer = lexer;
  }

  reset() {
    this.buffer = [];
    this.errors = [];
  }

  getBuffer() {
    return this.buffer;
  }

  getErrors() {
    return this.errors;
  }

  setLexer(lexer: Lexer) {
    this.lexer = lexer;
    return this;
  }

  addNodeReducer(r: NodeReducer) {
    this.reducers.push(r);
    return this;
  }

  parse(s: string) {
    this.buffer.push(
      ...this.lexer
        .lexAll(s)
        .map((t) => new ASTNode({ type: t.type, text: t.content }))
    );

    let tail = 1;
    outer: while (tail <= this.buffer.length) {
      // traverse all reducers
      for (const r of this.reducers) {
        let res = r.reduce(this.buffer.slice(0, tail), this.buffer.slice(tail));
        if (res.accept) {
          // construct new node
          let node = new ASTNode({
            type: res.type,
            children: this.buffer.slice(tail - res.digested, tail),
            error: res.error,
            data: res.data,
          });
          node.children.map((c) => (c.parent = node));

          // update parser state
          if (node.error) this.errors.push(node);
          this.buffer = this.buffer
            .slice(0, tail - res.digested)
            .concat(node)
            .concat(this.buffer.slice(tail));

          tail -= res.digested - 1; // consume n, produce 1

          continue outer; // re-traverse all reducers
        }
      }
      // no reducer can accept, move tail forward
      tail++;
    }

    return this.buffer;
  }
}
