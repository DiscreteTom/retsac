import { compose } from "@discretetom/r-compose";
import type { AcceptedActionDecoratorContext } from "../../action";
import { Action } from "../../action";
import { esc4regex } from "../common";
import type { IntegerLiteralData as CommonIntegerLiteralData } from "../numeric";
import {
  binaryIntegerLiteral as commonBinaryIntegerLiteral,
  octalIntegerLiteral as commonOctalIntegerLiteral,
  hexIntegerLiteral as commonHexIntegerLiteral,
} from "../numeric";

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
}): Action<
  {
    kind: never;
    data: {
      /**
       * If `true`, the numeric literal is invalid.
       */
      invalid: boolean;
    };
  },
  ActionState,
  ErrorType
> {
  const enableSeparator = !(options?.numericSeparator === false);
  const separator = esc4regex(String(options?.numericSeparator ?? "_")); // use String to handle `false`
  const boundary = options?.boundary ?? true;
  const acceptInvalid = options?.acceptInvalid ?? true;

  const valid = Action.from<never, undefined, ActionState, ErrorType>(
    compose(
      ({ concat, select, any, optional, lookahead }) => {
        const separatorPart = enableSeparator
          ? any(concat(separator, /\d+/))
          : "";
        return concat(
          select(
            /0x[\da-f]+/, // hexadecimal
            /0o[0-7]+/, // octal
            // below is decimal with separator
            concat(
              /\d+/, // integer part
              separatorPart, // separator and additional integer part
              optional(concat(/\.\d+/, separatorPart)), // decimal part
              optional(concat(/[eE][-+]?\d+/, separatorPart)), // exponent part
            ),
          ),
          boundary
            ? concat(
                /\b/,
                // '.' match /\b/ but is not allowed as the boundary
                lookahead(/\./, { negative: true }),
              )
            : "",
        );
      },
      "i", // case insensitive
    ),
  ).data(() => ({ invalid: false }));

  const invalid = Action.from<
    never,
    { invalid: boolean },
    ActionState,
    ErrorType
  >(
    compose(
      ({ select }) =>
        select(
          /0o[0-7]*[^0-7]+/, // octal literals that include non-octal characters
          /0x[\da-f]*[^\da-f]+/, // hexadecimal literals that include non-hexadecimal characters
          /(?:\d+\.){2,}/, // numeric literals that include more than one decimal point
          /\d+\.\.\d+/, // numeric literals that include more than one decimal point without any other characters in between
          /\d+e[+-]?\d+e[+-]?\d+/, // numeric literals that include more than one exponent (e or E)
          /\d+e/, // numeric literals that end with an exponent but without any digits after the exponent symbol
        ),
      "i",
    ),
  ).data(() => ({ invalid: true }));

  if (acceptInvalid) {
    return valid.or(invalid);
  } else {
    // only accept valid numbers
    return valid;
  }
}

export type IntegerLiteralOptions = {
  /**
   * If `true`, the action will accept invalid numeric literal and record errors in the data.
   *
   * If `false`, the action will reject invalid numeric literal.
   * @default true
   */
  acceptInvalid?: boolean;
};

export type IntegerLiteralData = {
  /**
   * If `true`, there is a separator at the beginning, after the prefix.
   */
  leadingSeparator: boolean;
  /**
   * If `true`, there is a separator at the end, before the suffix.
   */
  tailingSeparator: boolean;
  /**
   * The index of the whole input string where the consecutive separator is located.
   */
  consecutiveSeparatorIndexes: number[];
} & CommonIntegerLiteralData;

export function integerLiteralDataMapper<ActionState, ErrorType>({
  input,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonIntegerLiteralData },
  ActionState,
  ErrorType
>): IntegerLiteralData {
  const lastSeparator = output.data.separators.at(-1);

  return {
    leadingSeparator:
      output.data.separators[0]?.index ===
      input.start + output.data.prefix.length,
    tailingSeparator:
      lastSeparator === undefined
        ? false
        : lastSeparator.index + lastSeparator.content.length ===
          input.start - output.digested,
    consecutiveSeparatorIndexes: output.data.separators
      .map((s, i, arr) => {
        if (i === 0) return -1;
        if (arr[i - 1].index + arr[i - 1].content.length === s.index)
          return s.index;
        return -1;
      })
      .filter((i) => i !== -1),
    ...output.data,
  };
}

export function integerLiteralRejecter<ActionState, ErrorType>({
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: IntegerLiteralData },
  ActionState,
  ErrorType
>): boolean {
  return (
    output.data.leadingSeparator ||
    output.data.tailingSeparator ||
    output.data.consecutiveSeparatorIndexes.length > 0
  );
}

/**
 * Create an action that accepts JavaScript's binary integer literal (`0b101n`).
 */
export function binaryIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  const action = commonBinaryIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);

  return options?.acceptInvalid ?? true
    ? action
    : action.reject(integerLiteralRejecter);
}

/**
 * Create an action that accepts JavaScript's octal integer literal (`0o707n`).
 */
export function octalIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  const action = commonOctalIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);

  return options?.acceptInvalid ?? true
    ? action
    : action.reject(integerLiteralRejecter);
}

/**
 * Create an action that accepts JavaScript's hexadecimal integer literal (`0xF0Fn`).
 */
export function hexIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  const action = commonHexIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);

  return options?.acceptInvalid ?? true
    ? action
    : action.reject(integerLiteralRejecter);
}
