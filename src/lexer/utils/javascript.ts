import type { Action } from "../action";
import { comment as commonComment } from "./common";

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

export function comment<
  Data = never,
  ActionState = never,
  ErrorType = never,
>(): Action<Data, ActionState, ErrorType> {
  return commonComment<Data, ActionState, ErrorType>("//").or(
    commonComment("/*", "*/"),
  );
}
