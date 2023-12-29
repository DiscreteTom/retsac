import { tryOrDefault } from "../../../try";
import type { AcceptedActionDecoratorContext } from "../../action";
import type { Action } from "../../action";
import type {
  IntegerLiteralData as CommonIntegerLiteralData,
  NumericLiteralData as CommonNumericLiteralData,
} from "../numeric";
import {
  binaryIntegerLiteral as commonBinaryIntegerLiteral,
  octalIntegerLiteral as commonOctalIntegerLiteral,
  hexIntegerLiteral as commonHexIntegerLiteral,
  numericLiteral as commonNumericLiteral,
} from "../numeric";

export type IntegerLiteralData = {
  /**
   * The value of the integer literal.
   * This will try to be parsed even if the integer literal is invalid.
   */
  value: number | bigint;
  /**
   * `undefined` if the integer literal is valid.
   */
  invalid?: {
    /**
     * If `true`, the integer literal's content is empty.
     */
    emptyContent: boolean;
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
  };
} & CommonIntegerLiteralData;

/**
 * Transform {@link CommonIntegerLiteralData} to {@link IntegerLiteralData}.
 */
export function integerLiteralDataMapper<ActionState, ErrorType>({
  input,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonIntegerLiteralData },
  ActionState,
  ErrorType
>): IntegerLiteralData {
  const lastSeparator = output.data.separators.at(-1);

  const rawInvalid: NonNullable<IntegerLiteralData["invalid"]> = {
    emptyContent: output.data.body.length === 0,
    leadingSeparator:
      output.data.separators[0]?.index ===
      input.start + output.data.prefix.length,
    tailingSeparator:
      lastSeparator === undefined
        ? false
        : lastSeparator.index + lastSeparator.content.length ===
          input.start + output.digested,
    consecutiveSeparatorIndexes: output.data.separators
      .map((s, i, arr) => {
        if (i === 0) return -1;
        if (arr[i - 1].index + arr[i - 1].content.length === s.index)
          return s.index;
        return -1;
      })
      .filter((i) => i !== -1),
  };

  return {
    value: tryOrDefault(
      () =>
        output.data.suffix === "n"
          ? BigInt(output.data.prefix + output.data.body)
          : Number(output.data.prefix + output.data.body),
      0,
    ),
    invalid:
      rawInvalid.emptyContent ||
      rawInvalid.leadingSeparator ||
      rawInvalid.tailingSeparator ||
      rawInvalid.consecutiveSeparatorIndexes.length > 0
        ? rawInvalid
        : undefined,
    ...output.data,
  };
}

/**
 * Create an action that accepts JavaScript's binary integer literal (`0b101n`).
 */
export function binaryIntegerLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return commonBinaryIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);
}

/**
 * Create an action that accepts JavaScript's octal integer literal (`0o707n`).
 */
export function octalIntegerLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return commonOctalIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);
}

/**
 * Create an action that accepts JavaScript's hexadecimal integer literal (`0xF0Fn`).
 */
export function hexIntegerLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return commonHexIntegerLiteral<ActionState, ErrorType>({
    separator: "_",
    suffix: "n",
  }).data(integerLiteralDataMapper);
}

export type NumericLiteralData = {
  /**
   * The value of the numeric literal.
   * This will try to be parsed even if the numeric literal is invalid.
   */
  value: number | bigint;
  /**
   * `undefined` if the numeric literal valid.
   */
  invalid?: {
    /**
     * If `true`, the exponent identifier is provided but the exponent content is empty.
     */
    emptyExponent: boolean;
    leadingZero: boolean;
    bigIntWithFraction: boolean;
    bigIntWithExponent: boolean;
    /**
     * If `true`, there is no boundary between the numeric literal and the following identifier.
     */
    missingBoundary: boolean;
    /**
     * The index of the whole input string where the invalid separator is located.
     */
    invalidSeparatorIndexes: number[];
    /**
     * The index of the whole input string where the consecutive separator is located.
     */
    consecutiveSeparatorIndexes: number[];
  };
} & CommonNumericLiteralData;

export function numericLiteralDataMapper<ActionState, ErrorType>({
  input,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonNumericLiteralData },
  ActionState,
  ErrorType
>): NumericLiteralData {
  const rawInvalid: NonNullable<NumericLiteralData["invalid"]> = {
    emptyExponent:
      output.data.exponent !== undefined &&
      output.data.exponent.body.length === 0,
    leadingZero:
      output.data.integer.body.length > 1 &&
      output.data.integer.body.startsWith("0"),
    bigIntWithFraction:
      output.data.suffix === "n" && output.data.fraction !== undefined,
    bigIntWithExponent:
      output.data.suffix === "n" && output.data.exponent !== undefined,
    missingBoundary:
      input.buffer.length > input.start + output.digested &&
      // TODO: support unicode
      // see https://github.com/microsoft/TypeScript/blob/efc9c065a2caa52c5bebd08d730eed508075a78a/src/compiler/scanner.ts#L957
      input.buffer[input.start + output.digested].match(/[a-zA-Z_$]/) !== null,
    invalidSeparatorIndexes: [], // will be filled later
    consecutiveSeparatorIndexes: output.data.separators
      .map((s, i, arr) => {
        if (i === 0) return -1;
        if (arr[i - 1].index + arr[i - 1].content.length === s.index)
          return s.index;
        return -1;
      })
      .filter((i) => i !== -1),
  };

  // `0_` is invalid
  if (
    output.data.integer.body.startsWith("0") &&
    output.data.separators[0]?.index === input.start + 1
  ) {
    rawInvalid.invalidSeparatorIndexes.push(output.data.separators[0].index);
  }

  // separator should NOT be at start or end of each part
  output.data.separators.forEach((s) => {
    if (
      // start of integer
      s.index === input.start ||
      // start of fraction
      s.index === output.data.fraction?.index ||
      // start of exponent
      s.index === output.data.exponent?.index ||
      // end of integer
      s.index + s.content.length ===
        input.start + output.data.integer.digested ||
      // end of fraction
      (output.data.fraction !== undefined &&
        s.index + s.content.length ===
          output.data.fraction.index + output.data.fraction.digested) ||
      // end of exponent
      (output.data.exponent !== undefined &&
        s.index + s.content.length ===
          output.data.exponent.index + output.data.exponent.digested)
    ) {
      rawInvalid.invalidSeparatorIndexes.push(s.index);
    }
  });

  return {
    value: tryOrDefault(
      () =>
        output.data.suffix === "n"
          ? BigInt(output.data.integer.body) // only integer part is allowed
          : Number(
              output.data.integer.body +
                output.data.fraction?.point.content +
                output.data.fraction?.body +
                output.data.exponent?.indicator.content +
                output.data.exponent?.body,
            ),
      0,
    ),
    invalid:
      rawInvalid.emptyExponent ||
      rawInvalid.leadingZero ||
      rawInvalid.bigIntWithFraction ||
      rawInvalid.bigIntWithExponent ||
      rawInvalid.missingBoundary ||
      rawInvalid.invalidSeparatorIndexes.length > 0 ||
      rawInvalid.consecutiveSeparatorIndexes.length > 0
        ? rawInvalid
        : undefined,
    ...output.data,
  };
}
/**
 * JavaScript's numeric literal, including BigInt. E.g. `-0.123_456e-789n`.
 *
 * Integer literal is NOT included (e.g. `0b101`).
 */
export function numericLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: NumericLiteralData;
  },
  ActionState,
  ErrorType
> {
  return commonNumericLiteral<ActionState, ErrorType>({
    prefix: /(?:[+-]\s*)?/,
    decimalPoint: ".",
    exponentIndicator: /[eE](?:[+-])?/,
    separator: "_",
    suffix: "n",
  }).data(numericLiteralDataMapper);
}
