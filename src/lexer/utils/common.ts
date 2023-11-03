import type { ActionInput } from "../action";
import { Action, makeRegexAutoGlobal, makeRegexAutoSticky } from "../action";

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
export function whitespaces<ActionState = never, ErrorType = never>(): Action<
  never,
  ActionState,
  ErrorType
> {
  return Action.from<never, ActionState, ErrorType>(/\s+/);
}

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function fromTo<ActionState = never, ErrorType = never>(
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
): Action<never, ActionState, ErrorType> {
  // make sure regex has the flag 'y/g' so we can use `regex.lastIndex` to reset state.
  if (from instanceof RegExp && (options.autoSticky ?? true))
    from = makeRegexAutoSticky(from);
  if (to instanceof RegExp && (options.autoGlobal ?? true))
    to = makeRegexAutoGlobal(to);

  /** Return how many chars are digested, return 0 for reject. */
  const checkFrom =
    from instanceof RegExp
      ? (input: ActionInput<ActionState>) => {
          (from as RegExp).lastIndex = input.start;
          const res = (from as RegExp).exec(input.buffer);
          if (!res || res.index === -1) return 0;
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
          if (res && res.index !== -1)
            return res.index + res[0].length - input.start;
          return 0;
        }
      : (input: ActionInput<ActionState>, fromDigested: number) => {
          const index = input.buffer.indexOf(
            to as string,
            input.start + fromDigested,
          );
          if (index !== -1) return index + (to as string).length - input.start;
          return 0;
        };

  return Action.from((input) => {
    const fromDigested = checkFrom(input);
    if (fromDigested === 0) return 0;

    const totalDigested = checkTo(input, fromDigested);

    // construct result
    if (totalDigested === 0)
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
export function comment<ActionState = never, ErrorType = never>(
  start: string | RegExp,
  /** Default: `\n` */
  end: string | RegExp = "\n",
  options?: Omit<Parameters<typeof fromTo>[2], "acceptEof"> & {
    /** Default: `true`. */
    acceptEof?: boolean;
  },
): Action<never, ActionState, ErrorType> {
  return fromTo<ActionState, ErrorType>(start, end, {
    ...options,
    acceptEof: options?.acceptEof ?? true,
  });
}
