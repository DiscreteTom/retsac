import { ParserContext } from "../../model";

/**
 * Reducer will use children's data to yield the parent's data.
 */
export type Reducer<T> = (
  data: (T | undefined)[],
  context: ParserContext<T>
) => T | undefined;
