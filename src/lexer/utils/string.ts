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
export function stringLiteral<ErrorType = string, ActionState = never>(
  /** The open quote. */
  open: string,
  options?: {
    /** The close quote. Equals to the open quote by default. */
    close?: string;
    /** Default: false. */
    multiline?: boolean;
    /** Default: true. */
    escape?: boolean;
    /**
     * If true (by default), unclosed string(`\n` or EOF for single line string, and EOF for multiline string)
     * will also be accepted and marked as `options.unclosedError`.
     */
    acceptUnclosed?: boolean;
    /** Default: `'unclosed string literal'` */
    unclosedError?: ErrorType;
  },
): Action<ErrorType, ActionState> {
  const close = options?.close ?? open;
  const multiline = options?.multiline ?? false;
  const escape = options?.escape ?? true;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const unclosedError =
    options?.unclosedError ?? ("unclosed string literal" as ErrorType);

  const action = Action.from<ErrorType, ActionState>(
    new RegExp(
      // open quote
      `(?:${esc4regex(open)})` +
        // content, non-greedy
        `(?:${
          escape
            ? `(?:\\\\.|[^\\\\${multiline ? "" : "\\n"}])` // exclude `\n` if not multiline
            : `(?:.${multiline ? "|\\n" : ""})` // if multiline, accept `\n`
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
  );

  if (acceptUnclosed) {
    return action.check(({ output }) =>
      output.content.endsWith(close) ? undefined : unclosedError,
    );
  }

  // else, not accept unclosed
  return action;
}
