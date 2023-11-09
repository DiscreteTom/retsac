import { compose } from "@discretetom/r-compose";
import { Action } from "../action";

/**
 * Match a string literal.
 *
 * Escape (`\`) will be handled correctly for quote, not for the string content,
 * so you have to parse those escaped content by yourself.
 *
 * E.g. `stringLiteral('"')` will match `"abc\"def"` and return `"abc\"def"`.
 *
 * Set `multiline: true` to allow multiline string literals.
 */
export function stringLiteral<ActionState = never, ErrorType = never>(
  /** The open quote. */
  open: string,
  options?: {
    /** The close quote. Equals to the open quote by default. */
    close?: string;
    /** @default false */
    multiline?: boolean;
    /** @default true */
    escape?: boolean;
    /**
     * If `true`, unclosed string(`\n` or EOF for single line string, and EOF for multiline string)
     * will also be accepted and marked as `{ unclosed: true }` in `output.data`.
     * @default true
     */
    acceptUnclosed?: boolean;
    /**
     * If `true`, the string literal can be continued by `\` at the end of each line(`\\\n`),
     * even if `multiline` is `false`.
     *
     * The returned content will contains the `\\\n`, you have to process it by yourself.
     *
     * This option is effective even `options.escape` is `false`.
     * @default true
     */
    lineContinuation?: boolean;
  },
): Action<
  {
    kind: never;
    data: {
      /**
       * If `true`, the string literal is unclosed (`\n` or EOF for single line string, and EOF for multiline string).
       */
      unclosed: boolean;
    };
  },
  ActionState,
  ErrorType
> {
  const close = options?.close ?? open;
  const multiline = options?.multiline ?? false;
  const escaped = options?.escape ?? true;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const lineContinuation = options?.lineContinuation ?? true;

  const action = Action.from<never, undefined, ActionState, ErrorType>(
    compose(
      ({ concat, any, select, lookahead, escape, not }) =>
        concat(
          // match open quote
          escape(open),
          // match content
          any(
            escaped
              ? select(
                  lineContinuation ? /\\\n/ : "", // line continuation is treated as part of the content
                  /\\./, // any escaped character is treated as part of the content
                  not(
                    // any character except the following is treated as part of the content
                    concat(
                      /\\/, // standalone backslash shouldn't be treated as part of the content
                      multiline ? "" : /\n/, // if not multiline, `\n` shouldn't be treated as part of the content
                    ),
                  ),
                )
              : select(
                  lineContinuation ? /\\\n/ : "", // line continuation is treated as part of the content
                  /./, // any non-newline character is treated as part of the content
                  multiline ? /\n/ : "", // if multiline, `\n` should be treated as part of the content
                ),
            // since we use `/./` in the content, we need to make sure it doesn't match the close quote
            { greedy: false },
          ),
          // match close quote
          acceptUnclosed
            ? select(
                escape(close),
                "$", // unclosed string is acceptable, so EOF is acceptable
                multiline
                  ? "" // if multiline is enabled, we don't treat `\n` as the close quote
                  : lookahead(/\n/), // use lookahead so we don't include the `\n` in the result
              )
            : escape(close), // unclosed string is not accepted, so we only accept the close quote
        ),
      // DON'T set the `m` flag, because we want to match the whole string literal when `multiline` is true
      // if we set the `m` flag, the `$` will match the end of each line, instead of the end of the whole string literal
    ),
  ).data(() => ({ unclosed: false }));

  // set unclosed
  if (acceptUnclosed) {
    return action.data(({ output }) => ({
      unclosed: !output.content.split(/\\./).at(-1)!.endsWith(close),
    }));
  }

  // else, not accept unclosed
  return action;
}
