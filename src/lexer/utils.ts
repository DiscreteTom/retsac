import { Action } from "./action";

export function from_to(
  from: string | RegExp,
  to: string | RegExp,
  acceptEof: boolean
): Action {
  return Action.from((buffer) => {
    // check 'from'
    let fromDigested = 0;
    if (from instanceof RegExp) {
      let res = from.exec(buffer);
      if (!res || res.index == -1) return 0;
      fromDigested = res.index + res[0].length;
    } else {
      if (!buffer.startsWith(from)) return 0;
      fromDigested = from.length;
    }

    // check 'to'
    let rest = buffer.slice(fromDigested);
    let toDigested = 0;
    if (to instanceof RegExp) {
      let res = to.exec(rest);
      if (res && res.index != -1) toDigested = res.index + res[0].length;
    } else {
      let index = rest.indexOf(to);
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
 * Match a list of word, lookahead one char to ensure there is a word boundary.
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
 * Define types which name is the same as its word value.
 */
export function wordType(...words: string[]): { [type: string]: Action } {
  let result: { [type: string]: Action } = {};
  for (const w of words) {
    result[w] = word(w);
  }
  return result;
}

/**
 * Match a string literal, quoted in `''`(single) or `""`(double) or ``` `` ```(back).
 * Escaped quote `\"` and `\'` and `` \` `` will be handled correctly.
 * Escaped escape `\\` also will be handled correctly.
 * Set `multiline: true` to allow multiline string literals.
 */
export function stringLiteral(p: {
  single?: boolean;
  double?: boolean;
  back?: boolean;
  multiline?: boolean;
}) {
  return Action.from((buffer) => {
    let target =
      buffer.startsWith(`'`) && p.single
        ? "'"
        : buffer.startsWith(`"`) && p.double
        ? '"'
        : buffer.startsWith("`") && p.back
        ? "`"
        : "";
    if (target === "") return 0;

    for (let i = 1; i < buffer.length; ++i) {
      if (buffer[i] == "\\") {
        i++; // escape next
        continue;
      }
      if (buffer[i] == target) {
        if (p.multiline || !buffer.slice(0, i + 1).includes("\n")) return i + 1;
        else return 0; // multiline not allowed
      }
    }

    // eof, return
    return 0;
  });
}
