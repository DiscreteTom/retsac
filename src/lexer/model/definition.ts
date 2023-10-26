import type { Action } from "../action";

/** Apply `action` and try to yield a token with `kind`. */
export type Definition<ErrorType, Kinds extends string, ActionState> = {
  /** Target token kind. Empty string if anonymous. */
  kind: Kinds;
  action: Action<ErrorType, ActionState>;
};
