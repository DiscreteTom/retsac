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
   * `undefined` if the integer literal valid.
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
 * JavaScript's numeric literal. E.g. `0.123_456e-789n`.
 *
 * Integer literal is not included.
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
    prefix: /(?:[+-]\s*)?/,
    decimalPoint: ".",
    exponentIndicator: /[eE](?:[+-])?/,
    separator: "_",
    suffix: "n",
  }).data(numericLiteralDataMapper);

  return options?.acceptInvalid ?? true
    ? action
    : action.reject(numericLiteralRejecterFactory(options?.boundary ?? true));
}
