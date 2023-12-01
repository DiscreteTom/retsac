/**
 * Clone action state in a proper way.
 */
export type ActionStateCloner<ActionState> = (
  state: Readonly<ActionState>,
) => ActionState;

/**
 * Clone action state with structured clone (deep clone).
 */
export function defaultActionStateCloner<ActionState>(
  state: Readonly<ActionState>,
): ActionState {
  return structuredClone(state);
}
