import { Action } from "../action";
import { comment as commonComment } from "./common";

/**
 * Return an action that matches JavaScript comments (single line and multi line).
 */
export function comment<
  Data = never,
  ActionState = never,
  ErrorType = never,
>(): Action<Data, ActionState, ErrorType> {
  return commonComment<Data, ActionState, ErrorType>("//").or(
    commonComment("/*", "*/"),
  );
}

/**
 * Return an action that matches JavaScript regex literal.
 */
export function regexLiteral<ActionState = never, ErrorType = never>(options?: {
  /**
   * If `true`, the action may reject invalid JavaScript regex literal. See `options.rejectOnInvalid`.
   * @default true
   */
  validate?: boolean;
  /**
   * This option is only effective when `options.validate` is `true`.
   *
   * If `true`, reject if the regex is invalid.
   * If `false`, set `{invalid: true}` in the `token.data` if the regex is invalid.
   * @default true
   */
  rejectOnInvalid?: boolean;
  /**
   * Ensure there is a boundary after the regex.
   * This prevent to match something like `/a/g1`.
   * @default true
   */
  boundary?: boolean;
}): Action<{ invalid: boolean }, ActionState, ErrorType> {
  const action =
    options?.boundary ?? true
      ? Action.from<{ invalid: boolean }, ActionState, ErrorType>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)(?=\W|$)/,
        )
      : Action.from<{ invalid: boolean }, ActionState, ErrorType>(
          /\/(?:[^/\\]|\\.)+\/(?:[gimuy]*)/,
        );

  if (options?.validate ?? true) {
    if (options?.rejectOnInvalid ?? true) {
      return action.reject(({ output }) => {
        try {
          new RegExp(output.content);
        } catch (e) {
          return true;
        }
        return false;
      });
    }

    // else, set token.data on invalid
    return action.data(({ output }) => {
      try {
        new RegExp(output.content);
      } catch (e) {
        return { invalid: true };
      }
      return { invalid: false };
    });
  }

  // else, no validation
  return action;
}

/**
 * Evaluate a JavaScript string literal just like `eval`.
 * Caller should make sure the string is well-quoted and well-ended.
 * Interpolation is not supported.
 */
export function evalString(quoted: string) {
  const unquoted = quoted.slice(1, -1);

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#literals
  // IMPORTANT! all escaped chars should be searched simultaneously!
  // e.g. you should NOT use `unquoted.replace(/\\\\/g, "\\").replace(/\\'/g, "'")...`
  return unquoted.replace(
    /(\\0|\\'|\\"|\\n|\\\\|\\r|\\v|\\t|\\b|\\f|\\\n|\\`|\\x([0-9a-fA-F]{2})|\\u([0-9a-fA-F]{4}))/g,
    (match) => {
      switch (match) {
        case `\\0`:
          return "\0";
        case `\\'`:
          return "'";
        case `\\"`:
          return '"';
        case `\\n`:
          return "\n";
        case `\\\\`:
          return "\\";
        case `\\r`:
          return "\r";
        case `\\v`:
          return "\v";
        case `\\t`:
          return "\t";
        case `\\b`:
          return "\b";
        case `\\f`:
          return "\f";
        case `\\\n`:
          return "";
        case "\\`":
          return "`";
        default: {
          if (match.startsWith("\\x")) {
            return String.fromCharCode(parseInt(match.slice(2), 16));
          } else {
            // match.startsWith("\\u")
            return String.fromCharCode(parseInt(match.slice(2), 16));
          }
        }
      }
    },
  );
}
