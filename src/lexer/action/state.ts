export type ActionStateCloner<ActionState> = (
  ctx: Readonly<ActionState>,
) => ActionState;

/**
 * Clone action state with structured clone(deep clone).
 */
export function defaultActionStateCloner<ActionState>(
  ctx: Readonly<ActionState>,
): ActionState {
  return structuredClone(ctx);
}
