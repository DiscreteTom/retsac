import { ASTData } from "../ast";
import { GrammarCallback, ReducerContext } from "./model";

export function dataReducer(
  f: (data: any[], context: ReducerContext) => ASTData
): GrammarCallback {
  return (context) =>
    (context.data = f(
      context.matched.map((node) => node.data),
      context
    ));
}

export function valueReducer(
  f: (values: any[], context: ReducerContext) => any
): GrammarCallback {
  return (context) =>
    (context.data.value = f(
      context.matched.map((node) => node.data.value),
      context
    ));
}
