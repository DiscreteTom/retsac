import { Action } from "./action";

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 * @deprecated use `fromTo` instead.
 */
export function from_to(
  from: string | RegExp,
  to: string | RegExp,
  acceptEof: boolean
) {
  return fromTo(from, to, { acceptEof });
}

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
  return Action.from((buffer) => {
    // check 'from'
    let fromDigested = 0;
    if (from instanceof RegExp) {
      const res = from.exec(buffer);
      if (!res || res.index == -1) return 0;
      fromDigested = res.index + res[0].length;
    } else {
      if (!buffer.startsWith(from)) return 0;
      fromDigested = from.length;
    }

    // check 'to'
    const rest = buffer.slice(fromDigested);
    let toDigested = 0;
    if (to instanceof RegExp) {
      const res = to.exec(rest);
      if (res && res.index != -1) toDigested = res.index + res[0].length;
    } else {
      const index = rest.indexOf(to);
      if (index != -1) toDigested = index + to.length;
    }

    // construct result
    if (toDigested == 0)
      // 'to' not found
      return options.acceptEof
        ? // accept whole buffer
          buffer.length
        : // reject
          0;
    else return fromDigested + toDigested;
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
 * Match a string literal, quoted in `''`(single) or `""`(double) or ``` `` ```(back).
 *
 * Escape `\` will be handled correctly for quote, not for the string content.
 *
 * You can also use `from`/`to` or `quote` to specify your own string boundary.
 *
 * Set `multiline: true` to allow multiline string literals.
 */
export function stringLiteral(
  p: (
    | {
        single?: boolean;
        double?: boolean;
        back?: boolean;
      }
    | {
        from: string;
        to: string;
      }
    | { quote: string }
  ) & { multiline?: boolean }
) {
  return Action.from((buffer) => {
    let digested = 0;
    let endQuote = "";
    if ("single" in p && p.single && buffer.startsWith(`'`)) {
      endQuote = "'";
      digested = 1;
    } else if ("double" in p && p.double && buffer.startsWith(`"`)) {
      endQuote = '"';
      digested = 1;
    } else if ("back" in p && p.back && buffer.startsWith("`")) {
      endQuote = "`";
      digested = 1;
    } else if ("from" in p && buffer.startsWith(p.from)) {
      endQuote = p.to;
      digested = p.from.length;
    } else if ("quote" in p && buffer.startsWith(p.quote)) {
      endQuote = p.quote;
      digested = p.quote.length;
    } else return 0;

    for (let i = digested; i < buffer.length - endQuote.length + 1; ++i) {
      if (buffer[i] == "\\") {
        i++; // escape next
        continue;
      }
      if (buffer.slice(i, i + endQuote.length) == endQuote) {
        if (
          p.multiline ||
          !buffer.slice(digested, i + endQuote.length).includes("\n")
        )
          return i + endQuote.length;
        else return 0; // multiline not allowed
      }
    }

    // eof, return
    return 0;
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
 * You can use `Number(str.replaceAll(numericSeparator, ''))` to get the numeric value.
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
  acceptInvalid?: boolean;
  numericSeparator?: string | false;
}) {
  const acceptInvalid = options?.acceptInvalid ?? true;
  const numericSeparator = {
    enabled: options?.numericSeparator ?? true,
    separator: options?.numericSeparator ?? "_",
  };

  const valid = Action.from(
    /^(0x[\da-f]+|0o[0-7]+|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][-+]?\d+(?:_\d+)*)?)/i
  );
  const invalid = Action.from(
    /^0[0-7]+[89]|0x[^\da-f]|(?:\d+\.){2,}|\d+\.\d+\.|\d+e[+-]?\d+e[+-]?\d+|\d+e/i
  ).check(() => "Invalid numeric literal."); // TODO: use typed error?

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
