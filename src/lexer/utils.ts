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
 * Match a list of keyword, lookahead one char to ensure there is a word boundary.
 */
export function keyword(...words: string[]): Action {
  return Action.from((buffer) => {
    for (const word of words)
      if (
        buffer.startsWith(word) &&
        (buffer.length == word.length || /^\w/.test(buffer[word.length]))
      )
        return word.length;
    return 0;
  });
}
