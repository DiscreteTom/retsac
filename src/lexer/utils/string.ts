import { Action, rejectedActionOutput } from "../action";
import { esc4regex, fromTo } from "./common";

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
export function stringLiteral<E>(
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
    unclosedError?: E;
  }
): Action<E> {
  const close = options?.close ?? open;
  const multiline = options?.multiline ?? false;
  const escape = options?.escape ?? true;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const unclosedError = options?.unclosedError ?? "unclosed string literal";

  // if not escaped
  if (!escape) {
    if (multiline) {
      if (acceptUnclosed) {
        const action = fromTo(open, close, { acceptEof: true });
        return new Action((input) => {
          const res = action.exec(input);
          if (!res.accept) return res; // when `acceptEof` is `true`, only reject when `open` not found
          // else, accepted, which means `open` is found, and whether `close` is found or EOF is reached
          if (!res.content.endsWith(close)) {
            // EOF is reached, set unclosed error and accept
            res.error = unclosedError;
            return res;
          }
          return res; // `close` is found, accept
        });
      }
      // else, multiline but not accept unclosed
      return fromTo(open, close, { acceptEof: false });
    }
    // else, multiline not allowed

    const closeRegex = new RegExp(`${esc4regex(close)}|\\n`);
    if (acceptUnclosed) {
      /** Accept when `close` is found or `\n` is found, or EOF. */
      const action = fromTo(open, closeRegex, { acceptEof: true });
      return new Action((input) => {
        const res = action.exec(input);
        if (!res.accept) return res; // when `acceptEof` is `true`, only reject when `open` not found
        // else, whether `close` is found or `\n` is found or EOF is reached
        if (res.content.endsWith("\n")) {
          res.error = unclosedError;
          return res;
        }
        if (res.content.endsWith(close)) return res;
        // else, EOF is reached
        res.error = unclosedError;
        return res;
      });
    }
    // else, multiline not allowed and not accept unclosed
    /** Accept when `close` is found or `\n` is found. */
    const action = fromTo(open, closeRegex, { acceptEof: false });
    return new Action((input) => {
      const res = action.exec(input);
      if (!res.accept) return res; // `open` not found or `close`/`\n` not found
      // else, whether `close` is found or `\n` is found
      if (res.content.endsWith("\n")) return rejectedActionOutput; // reject
      return res; // `close` is found, accept
    });
  }
  // else, escaped

  /** Match escaped char (`\.`) or `close` or `\n`. */
  const regex = new RegExp(`\\\\.|${esc4regex(close)}|\\n`, "g");
  return Action.from<E>((input) => {
    if (input.buffer.startsWith(open, input.start))
      regex.lastIndex = open.length; // ignore the open quote
    else return 0; // open quote not found

    let offset = input.start + open.length;
    while (true) {
      regex.lastIndex = offset;
      const match = regex.exec(input.buffer);
      if (!match) {
        // close quote not found, EOF reached
        if (acceptUnclosed)
          // accept whole unclosed string
          return {
            digested: input.buffer.length - input.start,
            error: unclosedError as E,
          };
        return 0; // reject unclosed string
      }
      if (match[0] == close) {
        // close quote found
        const digested = match.index + match[0].length - input.start;
        return {
          digested,
        };
      }
      if (match[0] == "\n") {
        // multiline is allowed, continue
        if (multiline) {
          offset = match.index + match[0].length;
          continue;
        }
        // else, multiline is not allowed
        else if (acceptUnclosed) {
          // accept unclosed string
          const digested = match.index + 1 - input.start; // match is '\n', +1 to include '\n'
          return {
            digested,
            error: unclosedError as E,
          };
        }
        // else, not accept unclosed string
        return 0;
      }
      // else, escape found, continue
      offset = match.index + match[0].length;
    }
  });
}
