import { ASTNode } from "./ast";

export type Reducer = (current: ASTNode) => void;

export function valueReducer(f: (values: number[]) => number): Reducer {
  return (node) =>
    (node.data.value = f(node.children.map((c) => c.data.value)));
}
