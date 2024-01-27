import { Action } from "../action";
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
   *
   * Even this is provided, the action will still accept literals without the suffix.
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
  body: string;
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
      ? () => 0 // always accept if no suffix
      : suffix,
  );

  return Action.exec<IntegerLiteralData, ActionState, ErrorType>((input) => {
    // ensure the input starts with prefix
    const prefixMatch = prefixMatcher.exec(input, input.start);
    if (prefixMatch === undefined) return undefined;

    const data: IntegerLiteralData = {
      prefix: input.buffer.slice(input.start, input.start + prefixMatch),
      body: "",
      suffix: "",
      separators: [],
    };

    // check content and separators
    let pos = input.start + prefixMatch;
    while (true) {
      // check end of text
      if (pos >= input.buffer.length) break;

      // check separator
      if (separator !== undefined) {
        const separatorMatch = separator.exec(input, pos);
        if (separatorMatch !== undefined) {
          data.separators.push({
            index: pos,
            content: input.buffer.slice(pos, pos + separatorMatch),
          });
          pos += separatorMatch;
          continue;
        }
      }

      // check content
      const contentMatch = contentMatcher.exec(input, pos);
      if (contentMatch !== undefined) {
        data.body += input.buffer.slice(pos, pos + contentMatch);
        pos += contentMatch;
        continue;
      }

      const suffixMatch = suffixChecker.exec(input, pos);
      // check suffix
      if (suffixMatch !== undefined) {
        data.suffix = input.buffer.slice(pos, pos + suffixMatch);
        pos += suffixMatch;
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
   * If provided, the prefix must be matched.
   * E.g. `/[+-]?/`
   * @default undefined
   */
  prefix?: IntoSubAction<ActionState>;
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
  prefix: string;
  /**
   * The integer part of the numeric literal.
   */
  integer: {
    /**
     * The index of the whole input string where the integer part starts.
     */
    index: number;
    /**
     * Separators are removed.
     */
    body: string;
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
    body: string;
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
    body: string;
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

/**
 * @example
 * // integer only, no fraction, no exponent, no suffix
 * numericLiteral()
 * // allow fraction with custom decimal point
 * numericLiteral({ decimalPoint: "." })
 * // fraction and exponent
 * numericLiteral({ decimalPoint: ".", exponentIndicator: /[eE](?:[+-])?/ })
 * // suffix
 * numericLiteral({ suffix: "n" })
 * // numeric separator
 * numericLiteral({ separator: "_" })
 * // prefix
 * numericLiteral({ prefix: /[+-]?/ })
 * // all together
 * numericLiteral({ prefix: /[+-]?/, decimalPoint: ".", exponentIndicator: /[eE](?:[+-])?/, suffix: "n", separator: "_" })
 */
export function numericLiteral<ActionState = never, ErrorType = never>(
  options?: NumericLiteralOptions<ActionState>,
): Action<{ kind: never; data: NumericLiteralData }, ActionState, ErrorType> {
  const prefix =
    options?.prefix === undefined ? undefined : SubAction.from(options.prefix);
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
      prefix: "",
      integer: {
        index: pos,
        body: "",
        digested: 0,
      },
      fraction: undefined,
      exponent: undefined,
      suffix: "",
      separators: [],
    };

    // check prefix
    if (prefix !== undefined) {
      const prefixMatch = prefix.exec(input, pos);
      if (prefixMatch === undefined) return undefined;
      pos += prefixMatch;
      data.prefix = text.slice(input.start, pos);
      data.integer.index = pos;
    }

    while (true) {
      // check end of text
      if (pos >= text.length) break;

      // check separator
      if (separator !== undefined) {
        const separatorMatch = separator.exec(input, pos);
        if (separatorMatch !== undefined) {
          data.separators.push({
            index: pos,
            content: input.buffer.slice(pos, pos + separatorMatch),
          });
          pos += separatorMatch;
          switch (phase) {
            case NumericLiteralPhase.Integer:
              data.integer.digested += separatorMatch;
              break;
            case NumericLiteralPhase.Fraction:
              data.fraction!.digested += separatorMatch;
              break;
            case NumericLiteralPhase.Exponent:
              data.exponent!.digested += separatorMatch;
              break;
            default:
              throw new Error("Unknown numeric literal phase.");
          }
          continue;
        }
      }

      // check content
      const contentMatch = contentMatcher.exec(input, pos);
      if (contentMatch !== undefined) {
        switch (phase) {
          case NumericLiteralPhase.Integer:
            data.integer.body += input.buffer.slice(pos, pos + contentMatch);
            data.integer.digested += contentMatch;
            break;
          case NumericLiteralPhase.Fraction:
            data.fraction!.body += input.buffer.slice(pos, pos + contentMatch);
            data.fraction!.digested += contentMatch;
            break;
          case NumericLiteralPhase.Exponent:
            data.exponent!.body += input.buffer.slice(pos, pos + contentMatch);
            data.exponent!.digested += contentMatch;
            break;
          default:
            throw new Error("Unknown numeric literal phase.");
        }
        pos += contentMatch;
        continue;
      }

      // check decimal point
      if (phase === NumericLiteralPhase.Integer && decimal !== undefined) {
        const decimalMatch = decimal.exec(input, pos);
        if (decimalMatch !== undefined) {
          phase = NumericLiteralPhase.Fraction;
          data.fraction = {
            point: {
              index: pos,
              content: input.buffer.slice(pos, pos + decimalMatch),
            },
            index: pos + decimalMatch,
            body: "",
            digested: 0,
          };
          pos += decimalMatch;
          continue;
        }
      }

      // check scientific notation
      if (
        (phase === NumericLiteralPhase.Integer ||
          phase === NumericLiteralPhase.Fraction) &&
        scientific !== undefined
      ) {
        const scientificMatch = scientific.exec(input, pos);
        if (scientificMatch !== undefined) {
          data.exponent = {
            indicator: {
              index: pos,
              content: input.buffer.slice(pos, pos + scientificMatch),
            },
            index: pos + scientificMatch,
            body: "",
            digested: 0,
          };
          phase = NumericLiteralPhase.Exponent;
          pos += scientificMatch;
          continue;
        }
      }

      // check suffix
      if (suffix !== undefined) {
        const suffixMatch = suffix.exec(input, pos);
        if (suffixMatch !== undefined) {
          data.suffix = input.buffer.slice(pos, pos + suffixMatch);
          pos += suffixMatch;
        }
      }

      // otherwise
      break;
    }

    // reject if all parts are empty
    if (
      data.integer.body.length === 0 &&
      (data.fraction?.body.length ?? 0) === 0 &&
      (data.exponent?.body.length ?? 0) === 0
    )
      return undefined;
    // reject if no integer and fraction, but exponent exists
    // e.g. `.e1`
    if (
      data.integer.body.length === 0 &&
      (data.fraction?.body.length ?? 0) === 0 &&
      data.exponent !== undefined
    )
      return undefined;

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      digested: pos - input.start,
      muted: false,
      data,
    };
  });
}
