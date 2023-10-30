import { Action } from "../../action";
import { esc4regex } from "../common";

/**
 * Match the literal representations of numbers in JavaScript code.
 *
 * You can use `Number(token.content.replaceAll(numericSeparator, ''))` to get the numeric value.
 * The default numeric separator is `_`, you can customize it by setting `options.numericSeparator` to a string.
 *
 * If you want to disable the numeric separator, set `options.numericSeparator` to `false`.
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
 *   - `0o[0-7]*[^0-7]+`: Octal literals that include non-octal characters.
 *   - `0x[\da-f]*[^\da-f]+`: Hexadecimal literals that include non-hexadecimal characters.
 *   - `(?:\d+\.){2,}`: Numeric literals that include more than one decimal point.
 *   - `\d+\.\.\d+`: Numeric literals that include more than one decimal point without any other characters in between.
 *   - `\d+e[+-]?\d+e[+-]?\d+`: Numeric literals that include more than one exponent (e or E).
 *   - `\d+e`: Numeric literals that end with an exponent but without any digits after the exponent symbol.
 */
export function numericLiteral<
  ActionState = never,
  ErrorType = never,
>(options?: {
  /**
   * @default '_'
   */
  numericSeparator?: string | false;
  /**
   * If `true`, the numeric literal must have a boundary at the end (non inclusive).
   * @default true
   */
  boundary?: boolean;
  /**
   * If `true`, common invalid numeric literals will also be accepted and marked in `output.data` with `{ invalid: true }`.
   * @default true
   */
  acceptInvalid?: boolean;
}): Action<{ invalid: boolean }, ActionState, ErrorType>[] {
  const enableSeparator = !(options?.numericSeparator === false);
  const separator = esc4regex(String(options?.numericSeparator ?? "_")); // use String to handle `false`
  const boundary = options?.boundary ?? true;
  const acceptInvalid = options?.acceptInvalid ?? true;

  const valid = Action.from<never, ActionState, ErrorType>(
    enableSeparator
      ? new RegExp(
          `(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:${separator}\\d+)*(?:\\.\\d+(?:${separator}\\d+)*)?(?:[eE][-+]?\\d+(?:${separator}\\d+)*)?)${
            boundary ? "\\b(?!\\.)" : "" // '.' is not allowed as the boundary
          }`,
          "i",
        )
      : new RegExp(
          `(?:0x[\\da-f]+|0o[0-7]+|\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)${
            boundary ? "\\b(?!\\.)" : "" // '.' is not allowed as the boundary
          }`,
          "i",
        ),
  ).data(() => ({ invalid: false }));

  const invalid = Action.from<{ invalid: boolean }, ActionState, ErrorType>(
    /0o[0-7]*[^0-7]+|0x[\da-f]*[^\da-f]+|(?:\d+\.){2,}|\d+\.\.\d+|\d+e[+-]?\d+e[+-]?\d+|\d+e/i,
  ).data(() => ({ invalid: true }));

  if (acceptInvalid) {
    return [valid, invalid];
  } else {
    // only accept valid numbers
    return [valid];
  }
}
