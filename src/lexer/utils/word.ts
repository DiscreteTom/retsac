import { Action } from "../action";

/**
 * Match a list of strings exactly, ***NO LOOKAHEAD***.
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
