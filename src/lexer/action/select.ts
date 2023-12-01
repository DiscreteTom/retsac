import type { ExtractKinds, GeneralTokenDataBinding } from "../model";
import type { AcceptedActionDecoratorContext, Action } from "./action";

/**
 * Select a kind from action's kinds by action's input/output.
 */
export type ActionKindSelector<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> = (
  ctx: AcceptedActionDecoratorContext<DataBindings, ActionState, ErrorType>,
) => ExtractKinds<DataBindings>;

/**
 * @see {@link Action.kinds}
 */
export class MultiKindsAction<
  DataBindings extends GeneralTokenDataBinding,
  ActionState,
  ErrorType,
> {
  constructor(
    // make this private so the only thing user can do with this is to call `select` method
    private readonly action: Action<DataBindings, ActionState, ErrorType>,
  ) {}

  /**
   * Define a selector to select a kind from action's kinds by action's input/output.
   */
  select(selector: ActionKindSelector<DataBindings, ActionState, ErrorType>) {
    return this.action.apply((ctx) => {
      // make it mutable temporarily
      (ctx.output as { kind: ExtractKinds<DataBindings> }).kind = selector(ctx);
      return ctx.output;
    });
  }
}
