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
          input.start + output.digested,
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
    output.data.value.length === 0 ||
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

export type NumericLiteralOptions = {
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
};

export type NumericLiteralData = {
  emptyExponent: boolean;
  leadingZero: boolean;
  bigIntWithFraction: boolean;
  bigIntWithExponent: boolean;
  missingBoundary: boolean;
  invalidSeparatorIndexes: number[];
  /**
   * The index of the whole input string where the consecutive separator is located.
   */
  consecutiveSeparatorIndexes: number[];
} & CommonNumericLiteralData;

export function numericLiteralDataMapper<ActionState, ErrorType>({
  input,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonNumericLiteralData },
  ActionState,
  ErrorType
>): NumericLiteralData {
  const invalidSeparatorIndexes = [] as number[];

  // `0_` is invalid
  if (
    output.data.integer.value.startsWith("0") &&
    output.data.separators[0]?.index === input.start + 1
  ) {
    invalidSeparatorIndexes.push(output.data.separators[0].index);
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
      invalidSeparatorIndexes.push(s.index);
    }
  });

  return {
    emptyExponent:
      output.data.exponent !== undefined &&
      output.data.exponent.value.length === 0,
    leadingZero:
      output.data.integer.value.length > 1 &&
      output.data.integer.value.startsWith("0"),
    bigIntWithFraction:
      output.data.suffix === "n" && output.data.fraction !== undefined,
    bigIntWithExponent:
      output.data.suffix === "n" && output.data.exponent !== undefined,
    missingBoundary:
      input.buffer.length > input.start + output.digested &&
      // TODO: support unicode
      // see https://github.com/microsoft/TypeScript/blob/efc9c065a2caa52c5bebd08d730eed508075a78a/src/compiler/scanner.ts#L957
      input.buffer[input.start + output.digested].match(/[a-zA-Z_$]/) !== null,
    invalidSeparatorIndexes,
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

export function numericLiteralRejecterFactory<ActionState, ErrorType>(
  requireBoundary: boolean,
) {
  return function ({
    output,
  }: AcceptedActionDecoratorContext<
    { kind: never; data: NumericLiteralData },
    ActionState,
    ErrorType
  >): boolean {
    return (
      output.data.emptyExponent ||
      output.data.leadingZero ||
      output.data.bigIntWithFraction ||
      output.data.bigIntWithExponent ||
      (requireBoundary && output.data.missingBoundary) ||
      output.data.invalidSeparatorIndexes.length > 0 ||
      output.data.consecutiveSeparatorIndexes.length > 0
    );
  };
}

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
 */
export function numericLiteral<ActionState = never, ErrorType = never>(
  options?: NumericLiteralOptions,
): Action<
  {
    kind: never;
    data: NumericLiteralData;
  },
  ActionState,
  ErrorType
> {
  const action = commonNumericLiteral<ActionState, ErrorType>({
    decimalPoint: ".",
    exponentIndicator: /[eE](?:[+-])?/,
    separator: "_",
    suffix: "n",
  }).data(numericLiteralDataMapper);

  return options?.acceptInvalid ?? true
    ? action
    : action.reject(numericLiteralRejecterFactory(options?.boundary ?? true));
}
