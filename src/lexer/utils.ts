import { Action } from "./action";

/**
 * Match `from`, then find `to`. If `acceptEof` is `true`, accept buffer even `to` is not found.
 */
export function from_to(
  from: string | RegExp,
  to: string | RegExp,
  acceptEof: boolean
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
      return acceptEof
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
export function exact(...ss: string[]): Action {
  return Action.from((buffer) => {
    for (const s of ss) if (buffer.startsWith(s)) return s.length;
    return 0;
  });
}

/**
 * Match a list of word, lookahead one char to ensure there is a word boundary or end of input.
 */
export function word(...words: string[]): Action {
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
export function wordType(...words: string[]): { [type: string]: Action } {
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
        single?: true;
        double?: true;
        back?: true;
      }
    | {
        from: string;
        to: string;
      }
    | { quote: string }
  ) & { multiline?: true }
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
