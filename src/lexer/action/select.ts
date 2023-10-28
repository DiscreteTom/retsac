import type { AcceptedActionDecoratorContext, Action } from "./action";

export class ActionWithKinds<
  Kinds extends string,
  Data,
  ActionState,
  ErrorType,
> {
  constructor(
    public readonly kinds: readonly Kinds[],
    public readonly action: Action<Data, ActionState, ErrorType>,
  ) {}

  select(
    selector: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => Kinds,
  ) {
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
    public readonly selector: (
      ctx: AcceptedActionDecoratorContext<Data, ActionState, ErrorType>,
    ) => Kinds,
  ) {}
}
