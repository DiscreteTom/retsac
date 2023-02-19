import { ParserContext } from "../../model";

export interface ReducerContext<T> extends ParserContext<T> {
  /** Data of the children nodes. */
  values: (T | undefined)[];
}

/**
 * Reducer will use children's data to yield the parent's data.
 */
export type Reducer<T> = (context: ReducerContext<T>) => T | undefined;
