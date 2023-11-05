import type { GeneralTokenDataBinding } from "../model";
import { Action } from "./action";

/**
 * `ActionState` and `ErrorType` will be set by the lexer builder.
 */
export class ActionBuilder<ActionState, ErrorType> {
  /**
   * @alias {@link Action.exec}
   */
  exec<Data = undefined>(
    ...props: Parameters<typeof Action.exec<Data, ActionState, ErrorType>>
  ) {
    return Action.exec<Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.simple}
   */
  simple<Data = undefined>(
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
  from<Kinds extends string = never, Data = undefined>(
    ...props: Parameters<
      typeof Action.from<Kinds, Data, ActionState, ErrorType>
    >
  ) {
    return Action.from<Kinds, Data, ActionState, ErrorType>(...props);
  }

  /**
   * @alias {@link Action.reduce}
   */
  reduce<DataBindings extends GeneralTokenDataBinding = never>(
    ...props: Parameters<
      typeof Action.reduce<DataBindings, ActionState, ErrorType>
    >
  ) {
    return Action.reduce<DataBindings, ActionState, ErrorType>(...props);
  }
}
