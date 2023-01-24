import { BaseParserContext, Rejecter } from "../../model";

/**
 * Same param & return value as Rejecter, but flip result.
 * Which means, if return true, accept. If return false, reject.
 */
export type Accepter<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> = Rejecter<T, After, Ctx>;

/**
 * Reducer will use children's data to yield the parent's data.
 */
export type Reducer<T, Ctx> = (
  data: (T | undefined)[],
  context: Ctx
) => T | undefined;
