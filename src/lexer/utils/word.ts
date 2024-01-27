import { Action } from "../action";

/**
 * Match a list of strings exactly, ***NO LOOKAHEAD***.
 */
export function exact<ActionState = never, ErrorType = never>(
  ...ss: readonly string[]
): Action<{ kind: never; data: undefined }, ActionState, ErrorType> {
  return Action.from((input) => {
    for (const s of ss) {
      if (input.buffer.startsWith(s, input.start)) return s.length;
    }
    return 0;
  });
}

/**
 * Return a list of actions that match a list of strings exactly, ***NO LOOKAHEAD***.
 */
export function exactArray<ActionState = never, ErrorType = never>(
  ...ss: readonly string[]
): Action<{ kind: never; data: undefined }, ActionState, ErrorType>[] {
  return ss.map((s) => exact(s));
}

/**
 * Define kinds which name is the same as its literal value.
 */
export function exactKind<
  Kinds extends string = never,
  ActionState = never,
  ErrorType = never,
>(
  ...ss: readonly Kinds[]
): {
  [kind in Kinds]: Action<
    { kind: never; data: undefined },
    ActionState,
    ErrorType
  >;
} {
  const result: {
    [kind: string]: Action<
      { kind: never; data: undefined },
      ActionState,
      ErrorType
    >;
  } = {};
  for (const s of ss) {
    result[s] = exact(s);
  }
  return result as {
    [kind in Kinds]: Action<
      { kind: never; data: undefined },
      ActionState,
      ErrorType
    >;
  };
}

/**
 * Match a list of word, lookahead one char to ensure there is a word boundary or end of input.
 */
export function word<ActionState = never, ErrorType = never>(
  ...words: readonly string[]
): Action<{ kind: never; data: undefined }, ActionState, ErrorType> {
  return Action.from((input) => {
    for (const word of words)
      if (
        input.buffer.startsWith(word, input.start) &&
        (input.buffer.length === word.length + input.start || // end of input
          /^\W/.test(input.buffer[input.start + word.length])) // next char is word boundary
      )
        return word.length;
    return 0;
  });
}

/**
 * Return a list of actions that match a list of words, lookahead one char to ensure there is a word boundary or end of input.
 */
export function wordArray<ActionState = never, ErrorType = never>(
  ...words: readonly string[]
): Action<{ kind: never; data: undefined }, ActionState, ErrorType>[] {
  return words.map((s) => word(s));
}

/**
 * Define kinds which name is the same as its literal value.
 */
export function wordKind<
  Kinds extends string = never,
  ActionState = never,
  ErrorType = never,
>(
  ...words: readonly Kinds[]
): {
  [kind in Kinds]: Action<
    { kind: never; data: undefined },
    ActionState,
    ErrorType
  >;
} {
  const result: {
    [kind: string]: Action<
      { kind: never; data: undefined },
      ActionState,
      ErrorType
    >;
  } = {};
  for (const w of words) {
    result[w] = word(w);
  }
  return result as {
    [kind in Kinds]: Action<
      { kind: never; data: undefined },
      ActionState,
      ErrorType
    >;
  };
}
