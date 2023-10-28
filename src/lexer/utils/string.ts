import { Action } from "../action";
import { esc4regex } from "./common";

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
     * This option is effective even `options.escape` is `false`.
     * @default true
     */
    lineContinuation?: boolean;
  },
): Action<{ unclosed: boolean }, ActionState, ErrorType> {
  const close = options?.close ?? open;
  const multiline = options?.multiline ?? false;
  const escape = options?.escape ?? true;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const lineContinuation = options?.lineContinuation ?? true;

  const action = Action.from<never, ActionState, ErrorType>(
    new RegExp(
      // open quote
      `(?:${esc4regex(open)})` +
        // content, non-greedy
        `(?:${
          escape
            ? `(?:${lineContinuation ? "\\\\\\n|" : ""}\\\\.|[^\\\\${
                multiline ? "" : "\\n"
              }])` // exclude `\n` if not multiline
            : `(?:${lineContinuation ? "\\\\\\n|" : ""}.${
                multiline ? "|\\n" : ""
              })` // if multiline, accept `\n`
        }*?)` + // '*?' means non-greedy(lazy)
        // close quote
        `(?:${
          acceptUnclosed
            ? // if accept unclosed, accept '$'(EOF) or '\n'(if not multiline)
              `(?:${esc4regex(close)})|$${multiline ? "" : "|\\n"}`
            : esc4regex(close)
        })`,
      // DON'T set the `m` flag, because we want to match the whole string literal when `multiline` is true
      // if we set the `m` flag, the `$` will match the end of each line, instead of the end of the whole string literal
      // multiline ? "m" : undefined
    ),
  ).data(() => ({ unclosed: false }));

  // set unclosed
  if (acceptUnclosed) {
    return action.data(({ output }) => ({
      unclosed: output.content.split(/\\./).at(-1) !== close,
    }));
  }

  // else, not accept unclosed
  return action;
}
