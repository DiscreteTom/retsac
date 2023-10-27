import type { Action } from "../action";

/** Apply `action` and try to yield a token with `kind`. */
export type Definition<Kinds extends string, Data, ActionState, ErrorType> = {
  /** Target token kind. Empty string if anonymous. */
  kind: Kinds;
  action: Action<Data, ActionState, ErrorType>;
};
