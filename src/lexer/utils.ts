import { AcceptedActionOutput, Action, ActionInput } from "./action";

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function fromTo(
  from: string | RegExp,
  to: string | RegExp,
  options: {
    acceptEof: boolean;
    /**
     * Auto add the sticky flag to the `from` regex if `g` and `y` is not set.
     * Default: `true`.
     */
    autoSticky?: boolean;
    /**
     * Auto add the global flag to the `to` regex if `g` and `y` is not set.
     * Default: `true`.
     */
    autoGlobal?: boolean;
  }
): Action<any> {
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
      ? (input: ActionInput) => {
          (from as RegExp).lastIndex = input.start;
          const res = (from as RegExp).exec(input.buffer);
          if (!res || res.index == -1) return 0;
          return res[0].length;
        }
      : (input: ActionInput) => {
          if (!input.buffer.startsWith(from as string, input.start)) return 0;
          return (from as string).length;
        };
  /** Return how many chars are digested(including digested by `from`), return 0 for reject. */
  const checkTo =
    to instanceof RegExp
      ? (input: ActionInput, fromDigested: number) => {
          (to as RegExp).lastIndex = input.start + fromDigested;
          const res = (to as RegExp).exec(input.buffer);
          if (res && res.index != -1)
            return res.index + res[0].length - input.start;
          return 0;
        }
      : (input: ActionInput, fromDigested: number) => {
          const index = input.buffer.indexOf(
            to as string,
            input.start + fromDigested
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
 * Match a list of strings exactly, no lookahead.
 */
export function exact(...ss: readonly string[]): Action<any> {
  return Action.from((input) => {
    for (const s of ss) if (input.buffer.startsWith(s, input.start)) return s;
    return 0;
  });
}

/**
 * Match a list of word, lookahead one char to ensure there is a word boundary or end of input.
 */
export function word(...words: readonly string[]): Action<any> {
  return Action.from((input) => {
    for (const word of words)
      if (
        input.buffer.startsWith(word, input.start) &&
        (input.buffer.length == word.length + input.start || // end of input
          /^\W/.test(input.buffer[input.start + word.length])) // next char is word boundary
      )
        return word;
    return 0;
  });
}

/**
 * Define types which name is the same as its literal value.
 */
export function wordType(...words: readonly string[]): {
  [type: string]: Action<any>;
} {
  const result: { [type: string]: Action<any> } = {};
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
    /** Default: `'unclosed string literal'` */
    unclosedError?: any; // TODO: use generic type?
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
        return new Action((input) => {
          const res = action.exec(input);
          if (!res.accept) return res; // when `acceptEof` is `true`, only reject when `open` not found
          // else, accepted, which means `open` is found, and whether `close` is found or EOF is reached
          if (!res.content.endsWith(close))
            // EOF is reached, set unclosed error and accept
            return AcceptedActionOutput.from(res, { error: unclosedError });
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
        if (res.content.endsWith("\n"))
          return AcceptedActionOutput.from(res, { error: unclosedError });
        if (res.content.endsWith(close)) return res;
        return AcceptedActionOutput.from(res, { error: unclosedError }); // EOF is reached
      });
    }
    // else, multiline not allowed and not accept unclosed
    /** Accept when `close` is found or `\n` is found. */
    const action = fromTo(open, closeRegex, { acceptEof: false });
    return new Action((input) => {
      const res = action.exec(input);
      if (!res.accept) return res; // `open` not found or `close`/`\n` not found
      // else, whether `close` is found or `\n` is found
      if (res.content.endsWith("\n")) return { accept: false }; // reject
      return res; // `close` is found, accept
    });
  }
  // else, escaped

  /** Match escaped char (`\.`) or `close` or `\n`. */
  const regex = new RegExp(`\\\\.|${esc4regex(close)}|\\n`, "g");
  return Action.from((input) => {
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
            error: unclosedError,
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
            error: unclosedError,
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

/**
 * Use regex `\s+` instead of `\s` to reduce token emitted, to accelerate the lexing process.
 */
export const whitespaces = Action.from<any>(/\s+/);

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
  /** Default: `\n` */
  end: string | RegExp = "\n",
  options?: { acceptEof?: boolean }
) {
  return fromTo(start, end, { acceptEof: options?.acceptEof ?? true });
}

// TODO: split this into multiple functions?
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
 *   - `0o[0-7]*[^0-7]+`: Octal literals that include non-octal characters.
 *   - `0x[\da-f]*[^\da-f]+`: Hexadecimal literals that include non-hexadecimal characters.
 *   - `(?:\d+\.){2,}`: Numeric literals that include more than one decimal point.
 *   - `\d+\.\.\d+`: Numeric literals that include more than one decimal point without any other characters in between.
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
  const separator = esc4regex(String(options?.numericSeparator ?? "_"));
  const boundary = options?.boundary ?? true;
  const acceptInvalid = options?.acceptInvalid ?? true;
  const invalidError = options?.invalidError ?? "invalid numeric literal";

  // ensure non-capture group to optimize performance
  const valid = Action.from(
    enableSeparator
      ? new RegExp(
          `(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:${separator}\\d+)*(?:\\.\\d+(?:${separator}\\d+)*)?(?:[eE][-+]?\\d+(?:${separator}\\d+)*)?)${
            boundary ? "\\b(?!\\.)" : "" // '.' is not allowed as the boundary
          }`,
          "i"
        )
      : new RegExp(
          `(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)${
            boundary ? "\\b(?!\\.)" : "" // '.' is not allowed as the boundary
          }}`,
          "i"
        )
  );
  const invalid = Action.from(
    /0o[0-7]*[^0-7]+|0x[\da-f]*[^\da-f]+|(?:\d+\.){2,}|\d+\.\.\d+|\d+e[+-]?\d+e[+-]?\d+|\d+e/i
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
