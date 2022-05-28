import { Token } from "../lexer/lexer";
import { ASTNode } from "./ast";

export type ReducerContext = {
  node: ASTNode; // current node
  reject: boolean;
  readonly before: (Token | ASTNode)[]; // entities before current node
  readonly after: (Token | ASTNode)[]; // entities after current node
};

export type Reducer = (context: ReducerContext) => void;

export function valueReducer(f: (values: number[]) => number): Reducer {
  return ({ node }) =>
    (node.data.value = f(node.children.map((c) => c.data.value)));
}
