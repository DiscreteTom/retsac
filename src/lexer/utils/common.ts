import { Action } from "../action";

/**
 * Escape regex special characters.
 */
export function esc4regex(str: string) {
  // ref: https://github.com/DiscreteTom/r-compose/blob/193231b7a766d3809c91dea85ac58171806cb0b1/src/index.ts#L38
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Use regex `\s+` instead of `\s` to reduce token emitted, to accelerate the lexing process.
 */
export function whitespaces<ActionState = never, ErrorType = never>(): Action<
  { kind: never; data: undefined },
  ActionState,
  ErrorType
> {
  return Action.from<never, undefined, ActionState, ErrorType>(/\s+/);
}

/**
 * Match from the `start` to the `end`, accept even reach the end of the input.
 *
 * @example
 * comment('//'); // single line comment
 * comment('<!--', '-->'); // multiline comment
 */
export function comment<ActionState = never, ErrorType = never>(
  start: string,
  /**
   * @default '\n'
   */
  end: string = "\n",
): Action<{ kind: never; data: undefined }, ActionState, ErrorType> {
  return Action.exec((input) => {
    // check start
    if (!input.buffer.startsWith(start, input.start)) return undefined;

    // match end
    const rawEndIndex = input.buffer.indexOf(end, input.start);
    const safeEndIndex =
      rawEndIndex < 0 ? input.buffer.length : rawEndIndex + end.length;

    return {
      accept: true,
      content: input.buffer.slice(input.start, safeEndIndex),
      data: undefined,
      digested: safeEndIndex - input.start,
      muted: false,
    };
  });
}
