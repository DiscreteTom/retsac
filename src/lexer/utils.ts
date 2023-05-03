import { Action } from "./action";

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function fromTo(
  from: string | RegExp,
  to: string | RegExp,
  options: {
    acceptEof: boolean;
  }
): Action {
  /** Return how many chars are digested, return 0 for reject. */
  const checkFrom =
    from instanceof RegExp
      ? (buffer: string) => {
          const res = from.exec(buffer);
          if (!res || res.index == -1) return 0;
          return res.index + res[0].length;
        }
      : (buffer: string) => {
          if (!buffer.startsWith(from)) return 0;
          return from.length;
        };
  /** Return how many chars are digested(including digested by `from`), return 0 for reject. */
  const checkTo =
    to instanceof RegExp
      ? (buffer: string, digested: number) => {
          const rest = buffer.slice(digested); // TODO: optimize using `regex.lastIndex` to prevent slicing?
          const res = to.exec(rest);
          if (res && res.index != -1)
            return res.index + res[0].length + digested;
          return 0;
        }
      : (buffer: string, digested: number) => {
          const index = buffer.indexOf(to, digested);
          if (index != -1) return index + to.length;
          return 0;
        };

  return Action.from((buffer) => {
    const fromDigested = checkFrom(buffer);
    if (fromDigested == 0) return 0;

    const digested = checkTo(buffer, fromDigested);

    // construct result
    if (digested == 0)
      // 'to' not found
      return options.acceptEof
        ? // accept whole buffer
          buffer.length
        : // reject
          0;

    return digested; // `to` found
  });
}

/**
 * Match a list of strings exactly, no lookahead.
 */
export function exact(...ss: readonly string[]): Action {
  return Action.from((buffer) => {
    for (const s of ss) if (buffer.startsWith(s)) return s.length;
    return 0;
  });
}

/**
 * Match a list of word, lookahead one char to ensure there is a word boundary or end of input.
 */
export function word(...words: readonly string[]): Action {
  return Action.from((buffer) => {
    for (const word of words)
      if (
        buffer.startsWith(word) &&
        (buffer.length == word.length || /^\W/.test(buffer[word.length]))
      )
        return word.length;
    return 0;
  });
}

/**
 * Define types which name is the same as its literal value.
 */
export function wordType(...words: readonly string[]): {
  [type: string]: Action;
} {
  const result: { [type: string]: Action } = {};
  for (const w of words) {
    result[w] = word(w);
  }
  return result;
}

/**
 * Escape regex special characters.
 */
export function esc4regex(str: string) {
  return str.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

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
export function stringLiteral(
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
    /** Default: `'unclosed string'` */
    unclosedError?: any;
  }
) {
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
        return new Action((buffer) => {
          const res = action.exec(buffer);
          if (!res.accept) return res; // when `acceptEof` is `true`, only reject when `open` not found
          // else, accepted, which means `open` is found, and whether `close` is found or EOF is reached
          if (!res.content.endsWith(close))
            // EOF is reached, set unclosed error and accept
            return { ...res, error: unclosedError };
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
      return new Action((buffer) => {
        const res = action.exec(buffer);
        if (!res.accept) return res; // when `acceptEof` is `true`, only reject when `open` not found
        // else, whether `close` is found or `\n` is found or EOF is reached
        if (res.content.endsWith("\n")) return { ...res, error: unclosedError };
        if (res.content.endsWith(close)) return res;
        return { ...res, error: unclosedError }; // EOF is reached
      });
    }
    // else, multiline not allowed and not accept unclosed
    /** Accept when `close` is found or `\n` is found. */
    const action = fromTo(open, closeRegex, { acceptEof: false });
    return new Action((buffer) => {
      const res = action.exec(buffer);
      if (!res.accept) return res; // `open` not found or `close`/`\n` not found
      // else, whether `close` is found or `\n` is found
      if (res.content.endsWith("\n")) return { accept: false }; // reject
      return res; // `close` is found, accept
    });
  }
  // else, escaped

  /** Match escaped char (`\.`) or `close` or `\n`. */
  const regex = new RegExp(`\\\\.|${esc4regex(close)}|\\n`, "g");
  return new Action((buffer) => {
    if (buffer.startsWith(open))
      regex.lastIndex = open.length; // ignore the open quote
    else return { accept: false }; // open quote not found

    while (true) {
      const match = regex.exec(buffer);
      if (!match) {
        // close quote not found, EOF reached
        if (acceptUnclosed)
          // accept unclosed string
          return {
            accept: true,
            digested: buffer.length,
            content: buffer,
            muted: false,
            rest: "",
            error: unclosedError,
          };
        return { accept: false }; // reject unclosed string
      }
      if (match[0] == close) {
        // close quote found
        const digested = match.index + match[0].length;
        return {
          accept: true,
          digested,
          content: buffer.slice(0, digested),
          rest: buffer.slice(digested),
          muted: false,
        };
      }
      if (match[0] == "\n") {
        // multiline is allowed, continue
        if (multiline) continue;
        // else, multiline is not allowed
        if (acceptUnclosed) {
          // accept unclosed string
          const digested = match.index + 1; // match[0].length == 1
          return {
            accept: true,
            digested,
            content: buffer.slice(0, digested),
            rest: buffer.slice(digested),
            muted: false,
            error: unclosedError,
          };
        }
        // else, not accept unclosed string
        return { accept: false };
      }
      // else, escape found, continue
    }
  });
}

/**
 * Use regex `\s+` instead of `\s` to reduce token emitted, to accelerate the lexing process.
 */
export const whitespaces = Action.from(/^\s+/);

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
export function comment(
  start: string | RegExp,
  end: string | RegExp = "\n",
  options?: { acceptEof?: boolean }
) {
  return fromTo(start, end, { acceptEof: options?.acceptEof ?? true });
}

/**
 * Match the literal representations of numbers in JavaScript code.
 *
 * You can use `Number(token.content.replaceAll(numericSeparator, ''))` to get the numeric value.
 * The default numeric separator is `_`, you can customize it by setting `options.numericSeparator` to a string.
 *
 * If you want to disable the numeric separator, set `options.numericSeparator` to `false`.
 *
 * If `options.acceptInvalid` is `true` (by default), common invalid numeric literals will also be matched and marked with error.
 *
 * E.g.
 * - Valid numeric literals
 *   - `42`
 *   - `3.1415`
 *   - `1.5e10`
 *   - `0.123e-4`
 *   - `0x2a`
 *   - `0xFF`
 *   - `0o755`
 *   - `1_000_000`
 *   - `1_000_000.000_001`
 *   - `1e6_000`
 * - Invalid numeric literals
 *   - `0[0-7]+[89]`: Octal literals that include the digits 8 or 9.
 *   - `0x[^\da-f]`: Hexadecimal literals that include non-hexadecimal characters.
 *   - `(?:\d+\.){2,}`: Numeric literals that include more than one decimal point.
 *   - `\d+\.\d+\.`: Numeric literals that include more than one decimal point without any other characters in between.
 *   - `\d+e[+-]?\d+e[+-]?\d+`: Numeric literals that include more than one exponent (e or E).
 *   - `\d+e`: Numeric literals that end with an exponent but without any digits after the exponent symbol.
 */
export function numericLiteral(options?: {
  numericSeparator?: string | false;
  /**
   * If `true` (by default), the numeric literal must have a boundary at the end (non inclusive).
   */
  boundary?: boolean;
  /**
   * If `true` (by default), common invalid numeric literals will also be accepted and marked with `options.invalidError`.
   */
  acceptInvalid?: boolean;
  /** Default: `"invalid numeric literal"` */
  invalidError?: any;
}) {
  const enableSeparator = !(options?.numericSeparator === false);
  const separator = esc4regex((options?.numericSeparator ?? "_") as string);
  const boundary = options?.boundary ?? true;
  const acceptInvalid = options?.acceptInvalid ?? true;
  const invalidError = options?.invalidError ?? "invalid numeric literal";

  // ensure non-capture group to optimize performance
  const valid = Action.from(
    enableSeparator
      ? new RegExp(
          `^(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:${separator}\\d+)*(?:\\.\\d+(?:${separator}\\d+)*)?(?:[eE][-+]?\\d+(?:${separator}\\d+)*)?)${
            boundary ? "\\b" : ""
          }`,
          "i"
        )
      : new RegExp(
          `^(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)${
            boundary ? "\\b" : ""
          }}`,
          "i"
        )
  );
  const invalid = Action.from(
    /^0[0-7]+[89]|0x[^\da-f]|(?:\d+\.){2,}|\d+\.\d+\.|\d+e[+-]?\d+e[+-]?\d+|\d+e/i
  ).check(() => invalidError);

  if (acceptInvalid) {
    return new Action((buffer) => {
      // try match valid first
      const res = valid.exec(buffer);
      if (res.accept) return res;
      return invalid.exec(buffer);
    });
  } else {
    // only accept valid numbers
    return valid;
  }
}
