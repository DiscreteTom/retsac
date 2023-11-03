import type { AcceptedActionDecoratorContext, Action } from "./action";

/**
 * Select a kind from action's kinds by action's input/output.
 */
export type ActionKindSelector<
  Data,
  ActionState,
  ErrorType,
  Kinds extends string,
> = (
  ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
) => Kinds;

/**
 * @see {@link Action.kinds}
 */
export class ActionWithKinds<
  Kinds extends string,
  Data,
  ActionState,
  ErrorType,
> {
  constructor(
    private readonly kinds: readonly Kinds[],
    private readonly action: Action<Data, ActionState, ErrorType>,
  ) {}

  /**
   * Define a selector to select a kind from action's kinds by action's input/output.
   */
  map(selector: ActionKindSelector<Data, ActionState, ErrorType, Kinds>) {
    return new SelectedAction(this.kinds, this.action, selector);
  }
}

export class SelectedAction<
  Kinds extends string,
  Data,
  ActionState,
  ErrorType,
> {
  constructor(
    public readonly kinds: readonly Kinds[],
    public readonly action: Action<Data, ActionState, ErrorType>,
    public readonly selector: ActionKindSelector<
      Data,
      ActionState,
      ErrorType,
      Kinds
    >,
  ) {}
}
