import type { ActionInput } from "../action";
import { Action } from "../action";

/**
 * Escape regex special characters.
 */
export function esc4regex(str: string) {
  // use the `g` flag to replace all occurrences
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Use regex `\s+` instead of `\s` to reduce token emitted, to accelerate the lexing process.
 */
export function whitespaces<
  Data = never,
  ActionState = never,
  ErrorType = never,
>(): Action<Data, ActionState, ErrorType> {
  return Action.from<Data, ActionState, ErrorType>(/\s+/);
}

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function fromTo<Data = never, ActionState = never, ErrorType = never>(
  from: string | RegExp,
  to: string | RegExp,
  options: {
    acceptEof: boolean;
    /**
     * Auto add the `sticky` flag to the `from` regex if `g` and `y` is not set.
     * @default true
     */
    autoSticky?: boolean;
    /**
     * Auto add the `global` flag to the `to` regex if `g` and `y` is not set.
     * @default true
     */
    autoGlobal?: boolean;
  },
): Action<Data, ActionState, ErrorType> {
  // make sure regex has the flag 'y/g' so we can use `regex.lastIndex` to reset state.
  if (
    from instanceof RegExp &&
    (options.autoSticky ?? true) &&
    !from.sticky &&
    !from.global
  )
    from = new RegExp(from.source, from.flags + "y");
  if (
    to instanceof RegExp &&
    (options.autoGlobal ?? true) &&
    !to.sticky &&
    !to.global
  )
    to = new RegExp(to.source, to.flags + "g");

  /** Return how many chars are digested, return 0 for reject. */
  const checkFrom =
    from instanceof RegExp
      ? (input: ActionInput<ActionState>) => {
          (from as RegExp).lastIndex = input.start;
          const res = (from as RegExp).exec(input.buffer);
          if (!res || res.index == -1) return 0;
          return res[0].length;
        }
      : (input: ActionInput<ActionState>) => {
          if (!input.buffer.startsWith(from as string, input.start)) return 0;
          return (from as string).length;
        };
  /** Return how many chars are digested(including digested by `from`), return 0 for reject. */
  const checkTo =
    to instanceof RegExp
      ? (input: ActionInput<ActionState>, fromDigested: number) => {
          (to as RegExp).lastIndex = input.start + fromDigested;
          const res = (to as RegExp).exec(input.buffer);
          if (res && res.index != -1)
            return res.index + res[0].length - input.start;
          return 0;
        }
      : (input: ActionInput<ActionState>, fromDigested: number) => {
          const index = input.buffer.indexOf(
            to as string,
            input.start + fromDigested,
          );
          if (index != -1) return index + (to as string).length - input.start;
          return 0;
        };

  return Action.from((input) => {
    const fromDigested = checkFrom(input);
    if (fromDigested == 0) return 0;

    const totalDigested = checkTo(input, fromDigested);

    // construct result
    if (totalDigested == 0)
      // 'to' not found
      return options.acceptEof
        ? // accept whole rest buffer
          input.buffer.length - input.start
        : // reject
          0;

    return totalDigested; // `to` found
  });
}

/**
 * Match from the `start` to the `end`, accept EOF by default.
 *
 * @example
 * comment('//'); // single line comment
 * comment('<!--', '-->'); // multiline comment
 */
export function comment<Data = never, ActionState = never, ErrorType = never>(
  start: string | RegExp,
  /** Default: `\n` */
  end: string | RegExp = "\n",
  options?: Omit<Parameters<typeof fromTo>[2], "acceptEof"> & {
    /** Default: `true`. */
    acceptEof?: boolean;
  },
): Action<Data, ActionState, ErrorType> {
  return fromTo<Data, ActionState, ErrorType>(start, end, {
    ...options,
    acceptEof: options?.acceptEof ?? true,
  });
}

// TODO: move to javascript.ts
export function regexLiteral<ActionState = never, ErrorType = never>(options?: {
  /**
   * If `true`, the action may reject invalid regex literal. See `options.rejectOnInvalid`.
   * @default true
   */
  validate?: boolean;
  /**
   * This option is only effective when `options.validate` is `true`.
   *
   * If `true`, reject if the regex is invalid.
   * If `false`, set `{invalid: true}` in the `token.data` if the regex is invalid.
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
