import { Action } from "./action";

/**
 * `ActionState` and `ErrorType` will be set by the lexer builder.
 */
export class ActionBuilder<ActionState, ErrorType> {
  /**
   * @alias {@link Action Action's constructor}
   */
  new<Data>(
    ...props: ConstructorParameters<typeof Action<Data, ActionState, ErrorType>>
  ) {
    return new Action<Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.simple}
   */
  simple<Data>(
    ...props: Parameters<typeof Action.simple<Data, ActionState, ErrorType>>
  ) {
    return Action.simple<Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.match}
   */
  match(...props: Parameters<typeof Action.match<ActionState, ErrorType>>) {
    return Action.match<ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.from}
   */
  from<Data>(
    ...props: Parameters<typeof Action.from<Data, ActionState, ErrorType>>
  ) {
    return Action.from<Data, ActionState, ErrorType>(...props);
  }
}
