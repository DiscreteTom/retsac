import type { Action, ActionKindSelector } from "../action";

/**
 * Apply `action` and try to yield a token with `kind`.
 */
export type Definition<Kinds extends string, Data, ActionState, ErrorType> = {
  /**
   * Target token kind possibilities.
   * For most cases the list should only contain one element.
   * Empty string if anonymous.
   */
  kinds: ReadonlySet<Kinds>;
  action: Readonly<Action<Data, ActionState, ErrorType>>;
  selector: ActionKindSelector<Data, ActionState, ErrorType, Kinds>;
};
