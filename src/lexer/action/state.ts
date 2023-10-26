export type ActionStateCloner<ActionState> = (
  ctx: Readonly<ActionState>,
) => ActionState;
