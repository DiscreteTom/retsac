import { Token } from "../lexer/lexer";
import { ASTNode } from "./ast";

export type ReducerContext = {
  reject: boolean;
  readonly before: (Token | ASTNode)[];
  readonly after: (Token | ASTNode)[];
};

export type Reducer = (current: ASTNode, context: ReducerContext) => void;

export function valueReducer(f: (values: number[]) => number): Reducer {
  return (node) =>
    (node.data.value = f(node.children.map((c) => c.data.value)));
}
