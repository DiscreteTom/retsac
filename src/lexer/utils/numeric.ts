import { Action, rejectedActionOutput } from "../action";
import type { IntoSubAction } from "./subaction";
import { SubAction } from "./subaction";

export type IntegerLiteralOptions<ActionState> = {
  /**
   * If `undefined`, the numeric separator will be disabled.
   * @default undefined
   */
  separator?: IntoSubAction<ActionState>;
  /**
   * If provided, this is the suffix of the numeric literal.
   * E.g. the `n` suffix in JavaScript's big int literal.
   * @default undefined
   */
  suffix?: IntoSubAction<ActionState>;
};

export type IntegerLiteralData = {
  /**
   * The matched prefix if any.
   * Empty string if there is no prefix.
   */
  prefix: string;
  /**
   * The string value of the binary literal. Prefix, suffix and separators are removed.
   *
   * This might be an empty string if there is no content after the prefix.
   */
  value: string;
  /**
   * The matched suffix if any.
   * Empty string if there is no suffix.
   */
  suffix: string;
  separators: {
    /**
     * The index of the whole input string where the separator is located.
     */
    index: number;
    content: string;
  }[];
};

/**
 * Create an action that accepts custom integer literal.
 */
export function integerLiteral<ActionState = never, ErrorType = never>(
  options: {
    /**
     * E.g. `0b`, `0o`, `0x`.
     */
    prefix: IntoSubAction<ActionState>;
    /**
     * Specify how to match the integer content.
     * Separators should not be included.
     */
    content: IntoSubAction<ActionState>;
  } & IntegerLiteralOptions<ActionState>,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  const prefixMatcher = SubAction.from(options.prefix);
  const contentMatcher = SubAction.from(options.content);
  const separator =
    options.separator === undefined
      ? undefined
      : SubAction.from(options.separator);
  const suffix = options.suffix;
  const suffixChecker: SubAction<ActionState> = SubAction.from(
    suffix === undefined
      ? () => ({ accept: true, digested: 0 }) // always accept if no suffix
      : suffix,
  );

  return Action.exec<IntegerLiteralData, ActionState, ErrorType>((input) => {
    // ensure the input starts with prefix
    const prefixMatch = prefixMatcher.exec(input, input.start);
    if (!prefixMatch.accept) return rejectedActionOutput;

    const data: IntegerLiteralData = {
      prefix: input.buffer.slice(
        input.start,
        input.start + prefixMatch.digested,
      ),
      value: "",
      suffix: "",
      separators: [],
    };

    // check content and separators
    let pos = input.start + prefixMatch.digested;
    while (true) {
      // check end of text
      if (pos >= input.buffer.length) break;

      // check separator
      if (separator !== undefined) {
        const separatorMatch = separator.exec(input, pos);
        if (separatorMatch.accept) {
          data.separators.push({
            index: pos,
            content: input.buffer.slice(pos, pos + separatorMatch.digested),
          });
          pos += separatorMatch.digested;
          continue;
        }
      }

      // check content
      const contentMatch = contentMatcher.exec(input, pos);
      if (contentMatch.accept) {
        data.value += input.buffer.slice(pos, pos + contentMatch.digested);
        pos += contentMatch.digested;
        continue;
      }

      const suffixMatch = suffixChecker.exec(input, pos);
      // check suffix
      if (suffixMatch.accept) {
        data.suffix = input.buffer.slice(pos, pos + suffixMatch.digested);
        pos += suffixMatch.digested;
      }

      // otherwise
      break;
    }

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      digested: pos - input.start,
      muted: false,
      data,
    };
  });
}

/**
 * Create an action that accepts binary integer literal.
 * E.g. `0b101`.
 */
export function binaryIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions<ActionState>,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0b",
    content: /[01]/,
    separator: options?.separator,
    suffix: options?.suffix,
  });
}

/**
 * Create an action that accepts octal integer literal.
 * E.g. `0o123`.
 */
export function octalIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions<ActionState>,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0o",
    content: /[0-7]/,
    separator: options?.separator,
    suffix: options?.suffix,
  });
}

/**
 * Create an action that accepts hexadecimal integer literal.
 * E.g. `0x123`.
 */
export function hexIntegerLiteral<ActionState = never, ErrorType = never>(
  options?: IntegerLiteralOptions<ActionState>,
): Action<{ kind: never; data: IntegerLiteralData }, ActionState, ErrorType> {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0x",
    content: /[0-9a-fA-F]/,
    separator: options?.separator,
    suffix: options?.suffix,
  });
}

export type NumericLiteralOptions<ActionState> = {
  /**
   * The decimal point.
   * If `undefined`, the fraction part will not be digested.
   * @default undefined
   */
  decimalPoint?: IntoSubAction<ActionState>;
  /**
   * The exponent indicator.
   * If `undefined`, the exponent part will not be digested.
   * @default undefined
   */
  exponentIndicator?: IntoSubAction<ActionState>;
} & IntegerLiteralOptions<ActionState>;

export type NumericLiteralData = {
  /**
   * The integer part of the numeric literal.
   */
  integer: {
    /**
     * Separators are removed.
     */
    value: string;
    /**
     * How many characters are digested.
     */
    digested: number;
  };
  /**
   * The fraction part of the numeric literal.
   */
  fraction?: {
    /**
     * Info about the decimal point.
     */
    point: {
      /**
       * The index of the whole input string where the decimal point is located.
       */
      index: number;
      /**
       * The decimal point.
       */
      content: string;
    };
    /**
     * The index of the whole input string where the fraction part starts.
     * The decimal point is not included.
     */
    index: number;
    /**
     * Separators are removed.
     */
    value: string;
    /**
     * How many characters are digested.
     * The decimal point is not included.
     */
    digested: number;
  };
  /**
   * The exponent part of the numeric literal.
   */
  exponent?: {
    /**
     * Info about the exponent indicator.
     */
    indicator: {
      /**
       * The index of the whole input string where the exponent indicator is located.
       */
      index: number;
      /**
       * The exponent indicator.
       */
      content: string;
    };
    /**
     * The index of the whole input string where the exponent part starts.
     * The exponent indicator is not included.
     */
    index: number;
    /**
     * Separators are removed.
     */
    value: string;
    /**
     * How many characters are digested.
     * The exponent indicator is not included.
     */
    digested: number;
  };
  /**
   * The matched suffix if any.
   * Empty string if there is no suffix.
   */
  suffix: string;
  separators: {
    /**
     * The index of the whole input string where the separator is located.
     */
    index: number;
    content: string;
  }[];
};

enum NumericLiteralPhase {
  Integer,
  Fraction,
  Exponent,
}

export function numericLiteral<ActionState = never, ErrorType = never>(
  options?: NumericLiteralOptions<ActionState>,
): Action<{ kind: never; data: NumericLiteralData }, ActionState, ErrorType> {
  const separator =
    options?.separator === undefined
      ? undefined
      : SubAction.from(options.separator);
  const suffix =
    options?.suffix === undefined ? undefined : SubAction.from(options.suffix);
  const decimal =
    options?.decimalPoint === undefined
      ? undefined
      : SubAction.from(options.decimalPoint);
  const scientific =
    options?.exponentIndicator === undefined
      ? undefined
      : SubAction.from(options.exponentIndicator);
  const contentMatcher = SubAction.from(/[0-9]+/);

  return Action.exec<NumericLiteralData, ActionState, ErrorType>((input) => {
    const text = input.buffer;
    let pos = input.start;
    let phase = NumericLiteralPhase.Integer;

    const data: NumericLiteralData = {
      integer: {
        value: "",
        digested: 0,
      },
      fraction: undefined,
      exponent: undefined,
      suffix: "",
      separators: [],
    };

    while (true) {
      // check end of text
      if (pos >= text.length) break;

      // check separator
      if (separator !== undefined) {
        const separatorMatch = separator.exec(input, pos);
        if (separatorMatch.accept) {
          data.separators.push({
            index: pos,
            content: input.buffer.slice(pos, separatorMatch.digested),
          });
          pos += separatorMatch.digested;
          switch (phase) {
            case NumericLiteralPhase.Integer:
              data.integer.digested += separatorMatch.digested;
              break;
            case NumericLiteralPhase.Fraction:
              data.fraction!.digested += separatorMatch.digested;
              break;
            case NumericLiteralPhase.Exponent:
              data.exponent!.digested += separatorMatch.digested;
              break;
            default:
              throw new Error("Unknown numeric literal phase.");
          }
          continue;
        }
      }

      // check content
      const contentMatch = contentMatcher.exec(input, pos);
      if (contentMatch.accept) {
        switch (phase) {
          case NumericLiteralPhase.Integer:
            data.integer.value += input.buffer.slice(
              pos,
              pos + contentMatch.digested,
            );
            data.integer.digested += contentMatch.digested;
            break;
          case NumericLiteralPhase.Fraction:
            data.fraction!.value += input.buffer.slice(
              pos,
              pos + contentMatch.digested,
            );
            data.fraction!.digested += contentMatch.digested;
            break;
          case NumericLiteralPhase.Exponent:
            data.exponent!.value += input.buffer.slice(
              pos,
              pos + contentMatch.digested,
            );
            data.exponent!.digested += contentMatch.digested;
            break;
          default:
            throw new Error("Unknown numeric literal phase.");
        }
        pos += contentMatch.digested;
        continue;
      }

      // check decimal point
      if (decimal !== undefined) {
        const decimalMatch = decimal.exec(input, pos);
        if (decimalMatch.accept) {
          phase = NumericLiteralPhase.Fraction;
          data.fraction = {
            point: {
              index: pos,
              content: input.buffer.slice(pos, decimalMatch.digested),
            },
            index: pos + decimalMatch.digested,
            value: "",
            digested: 0,
          };
          pos += decimalMatch.digested;
          continue;
        }
      }

      // check scientific notation
      if (scientific !== undefined) {
        const scientificMatch = scientific.exec(input, pos);
        if (scientificMatch.accept) {
          data.exponent = {
            indicator: {
              index: pos,
              content: input.buffer.slice(pos, scientificMatch.digested),
            },
            index: pos + scientificMatch.digested,
            value: "",
            digested: 0,
          };
          phase = NumericLiteralPhase.Exponent;
          pos += scientificMatch.digested;
          continue;
        }
      }

      // check suffix
      if (suffix !== undefined) {
        const suffixMatch = suffix.exec(input, pos);
        if (suffixMatch.accept) {
          data.suffix = input.buffer.slice(pos, pos + suffixMatch.digested);
          pos += suffixMatch.digested;
        }
      }

      // otherwise
      break;
    }

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      digested: pos - input.start,
      muted: false,
      data,
    };
  });
}
