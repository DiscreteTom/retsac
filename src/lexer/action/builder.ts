import { Action } from "./action";

/**
 * `ActionState` and `ErrorType` will be set by the lexer builder.
 */
export class ActionBuilder<ActionState, ErrorType> {
  /**
   * @alias {@link Action.exec}
   */
  exec<Data = never>(
    ...props: Parameters<typeof Action.exec<Data, ActionState, ErrorType>>
  ) {
    return Action.exec<Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.simple}
   */
  simple<Data = never>(
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
   * @alias {@link Action.dryMatch}
   */
  dryMatch(
    ...props: Parameters<typeof Action.dryMatch<ActionState, ErrorType>>
  ) {
    return Action.dryMatch<ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.from}
   */
  from<Data = never>(
    ...props: Parameters<typeof Action.from<Data, ActionState, ErrorType>>
  ) {
    return Action.from<Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.reduce}
   */
  reduce<Data = never>(
    ...props: Parameters<typeof Action.reduce<Data, ActionState, ErrorType>>
  ) {
    return Action.reduce<Data, ActionState, ErrorType>(...props);
  }
}
