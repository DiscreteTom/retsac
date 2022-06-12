import { Action } from "./action";

export function from_to(from: string, to: string, acceptEof: boolean): Action {
  return Action.from((buffer) => {
    if (buffer.startsWith(from)) {
      let index = buffer.indexOf(to, from.length);
      if (index == -1)
        // not found
        return acceptEof
          ? // accept whole buffer
            buffer.length
          : // reject
            0;
      else return index + to.length;
    }
    return 0;
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
 * Set `multiline: true` to allow multiline string literals.
 */
export function stringLiteral(p: {
  single?: boolean;
  double?: boolean;
  back?: boolean;
  multiline?: boolean;
}) {
  return Action.from((buffer) => {
    let res =
      buffer.startsWith(`'`) && p.single
        ? /(^'|[^\\]')/.exec(buffer.slice(1))
        : buffer.startsWith(`"`) && p.double
        ? /(^"|[^\\]")/.exec(buffer.slice(1))
        : buffer.startsWith("`") && p.back
        ? /(^`|[^\\]`)/.exec(buffer.slice(1))
        : null;

    if (
      res &&
      res.index != -1 &&
      (p.multiline || !buffer.slice(1, res.index).includes("\n"))
    )
      return res.index + res[0].length;
    return 0;
  });
}
