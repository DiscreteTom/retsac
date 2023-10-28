import { Action } from "../../action";

/**
 * Return an action that matches JavaScript regex literal.
 */
export function regexLiteral<ActionState = never, ErrorType = never>(options?: {
  /**
   * If `true`, the action may reject invalid JavaScript regex literal. See `options.rejectOnInvalid`.
   * @default true
   */
  validate?: boolean;
  /**
   * This option is only effective when `options.validate` is `true`.
   *
   * If `true`, reject if the regex is invalid.
   * If `false`, set `{ invalid: true }` in the `token.data` if the regex is invalid.
   * @default true
   */
  rejectOnInvalid?: boolean;
  /**
   * Ensure there is a boundary after the regex.
   * This prevent to match something like `/a/g1`.
   * @default true
   */
  boundary?: boolean;
}): Action<{ invalid: boolean }, ActionState, ErrorType> {
  const action =
    options?.boundary ?? true
      ? Action.from<{ invalid: boolean }, ActionState, ErrorType>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)(?=\W|$)/,
        )
      : Action.from<{ invalid: boolean }, ActionState, ErrorType>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)/,
        );

  if (options?.validate ?? true) {
    if (options?.rejectOnInvalid ?? true) {
      return action.reject(({ output }) => {
        try {
          new RegExp(output.content);
        } catch (e) {
          return true;
        }
        return false;
      });
    }

    // else, set token.data on invalid
    return action.data(({ output }) => {
      try {
        new RegExp(output.content);
      } catch (e) {
        return { invalid: true };
      }
      return { invalid: false };
    });
  }

  // else, no validation
  return action;
}
