import { GrammarCallback, ReducerContext } from "./model";

export function dataReducer<T>(
  f: (data: T[], context: ReducerContext<T>) => T
): GrammarCallback<T> {
  return (context) =>
    (context.data = f(
      context.matched.map((node) => node.data),
      context
    ));
}
