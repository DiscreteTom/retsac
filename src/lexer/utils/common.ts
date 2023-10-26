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
export function whitespaces<ErrorType = string, ActionState = never>() {
  return Action.from<ErrorType, ActionState>(/\s+/);
}

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function fromTo<Data = never, ErrorType = string, ActionState = never>(
  from: string | RegExp,
  to: string | RegExp,
  options: {
    acceptEof: boolean;
    /**
     * Auto add the `sticky` flag to the `from` regex if `g` and `y` is not set.
     * Default: `true`.
     */
    autoSticky?: boolean;
    /**
     * Auto add the `global` flag to the `to` regex if `g` and `y` is not set.
     * Default: `true`.
     */
    autoGlobal?: boolean;
  },
): Action<Data, ErrorType, ActionState> {
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
 * E.g.
 *
 * ```ts
 * comment('//'); // single line comment
 * comment('/*', '*' + '/'); // multiline comment
 * ```
 */
export function comment<ErrorType = string, ActionState = never>(
  start: string | RegExp,
  /** Default: `\n` */
  end: string | RegExp = "\n",
  options?: Omit<Parameters<typeof fromTo>[2], "acceptEof"> & {
    /** Default: `true`. */
    acceptEof?: boolean;
  },
) {
  return fromTo<ErrorType, ActionState>(start, end, {
    ...options,
    acceptEof: options?.acceptEof ?? true,
  });
}

export function regexLiteral<
  Data = never,
  ErrorType = string,
  ActionState = never,
>(options?: {
  /**
   * Default: `true`.
   */
  validate?: boolean;
  /**
   * If `true`, reject if the regex is invalid and `validate` is `true`.
   * If `false`, set `invalidError` if the regex is invalid and `validate` is `true`.
   * Default: `true`.
   */
  rejectOnInvalid?: boolean;
  /**
   * Default: `"invalid regex literal"`.
   */
  invalidError?: ErrorType;
  /**
   * Ensure there is a boundary after the regex.
   * This prevent to match something like `/a/g1`.
   * Default: `true`.
   */
  boundary?: boolean;
}): Action<Data, ErrorType, ActionState> {
  const action =
    options?.boundary ?? true
      ? Action.from<Data, ErrorType, ActionState>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)(?=\W|$)/,
        )
      : Action.from<Data, ErrorType, ActionState>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)/,
        );

  const err = options?.invalidError ?? ("invalid regex literal" as ErrorType);

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

    // else, set error on invalid
    return action.check(({ output }) => {
      try {
        new RegExp(output.content);
      } catch (e) {
        return err;
      }
      return undefined;
    });
  }

  // else, no validation
  return action;
}
