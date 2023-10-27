import { Action } from "../action";

/**
 * Match a list of strings exactly, ***NO LOOKAHEAD***.
 */
export function exact<Data = never, ErrorType = string, ActionState = never>(
  ...ss: readonly string[]
): Action<Data, ActionState, ErrorType> {
  return Action.from((input) => {
    for (const s of ss) if (input.buffer.startsWith(s, input.start)) return s;
    return 0;
  });
}

/**
 * Return a list of actions that match a list of strings exactly, ***NO LOOKAHEAD***.
 */
export function exactArray<
  Data = never,
  ErrorType = string,
  ActionState = never,
>(...ss: readonly string[]): Action<Data, ActionState, ErrorType>[] {
  return ss.map((s) => exact(s));
}

/**
 * Define kinds which name is the same as its literal value.
 */
export function exactKind<
  Data = never,
  ErrorType = string,
  Kinds extends string = never,
  ActionState = never,
>(
  ...ss: readonly Kinds[]
): {
  [kind in Kinds]: Action<Data, ActionState, ErrorType>;
} {
  const result: { [kind: string]: Action<Data, ActionState, ErrorType> } = {};
  for (const s of ss) {
    result[s] = exact(s);
  }
  return result as {
    [kind in Kinds]: Action<Data, ActionState, ErrorType>;
  };
}

/**
 * Match a list of word, lookahead one char to ensure there is a word boundary or end of input.
 */
export function word<Data = never, ErrorType = string, ActionState = never>(
  ...words: readonly string[]
): Action<Data, ActionState, ErrorType> {
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
 * Return a list of actions that match a list of words, lookahead one char to ensure there is a word boundary or end of input.
 */
export function wordArray<
  Data = never,
  ErrorType = string,
  ActionState = never,
>(...words: readonly string[]): Action<Data, ActionState, ErrorType>[] {
  return words.map((s) => word(s));
}

/**
 * Define kinds which name is the same as its literal value.
 */
export function wordKind<
  Data = never,
  ErrorType = string,
  Kinds extends string = never,
  ActionState = never,
>(
  ...words: readonly Kinds[]
): {
  [kind in Kinds]: Action<Data, ActionState, ErrorType>;
} {
  const result: { [kind: string]: Action<Data, ActionState, ErrorType> } = {};
  for (const w of words) {
    result[w] = word(w);
  }
  return result as {
    [kind in Kinds]: Action<Data, ActionState, ErrorType>;
  };
}
