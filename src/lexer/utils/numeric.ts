import { Action, rejectedActionOutput } from "../action";
import type { IntoSubAction } from "./subaction";
import { SubAction } from "./subaction";

export type IntegerLiteralOptions<ActionState> = {
  /**
   * If `undefined`, the numeric separator will be disabled.
   * @default undefined
   */
  separator?: string;
  /**
   * If provided, this is the suffix of the integer literal.
   * E.g. the `n` suffix in JavaScript's big int literal.
   * @default undefined
   */
  suffix?: IntoSubAction<ActionState>;
  /**
   * If `true`, the action will accept invalid integer literal and record errors in the data.
   *
   * If `false`, the action will reject invalid integer literal.
   * @default true
   */
  acceptInvalid?: boolean;
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
) {
  const prefixMatcher = SubAction.from(options.prefix);
  const contentMatcher = SubAction.from(options.content);
  const separator = options.separator;
  const suffix = options.suffix;
  const suffixChecker: SubAction<ActionState> = SubAction.from(
    suffix === undefined
      ? () => ({ accept: true, digested: 0 }) // always accept if no suffix
      : suffix,
  );
  const rejectInvalid = !(options.acceptInvalid ?? true);

  return Action.exec<
    {
      /**
       * The string value of the binary literal. Prefix, suffix and separators are removed.
       */
      value: string;
      /**
       * If `true`, there is no content after the prefix.
       */
      empty: boolean;
      /**
       * If `true`, there is a separator at the beginning, after the prefix.
       */
      leadingSeparator: boolean;
      /**
       * If `true`, there is a separator at the end, before the suffix.
       */
      tailingSeparator: boolean;
      /**
       * The index of the consecutive separators.
       */
      consecutiveSeparatorIndex: number[];
    },
    ActionState,
    ErrorType
  >((input) => {
    // ensure the input starts with prefix
    const prefixMatch = prefixMatcher.exec(input, input.start);
    if (!prefixMatch.accept) return rejectedActionOutput;

    const data = {
      value: "",
      empty: false,
      leadingSeparator: false,
      tailingSeparator: false,
      consecutiveSeparatorIndex: [] as number[],
    };

    // check content and separators
    let lastPartIsSeparator = false;
    let pos = input.start + prefixMatch.digested;
    while (true) {
      // check end of text
      if (pos >= input.buffer.length) break;

      // check separator
      if (separator !== undefined && input.buffer.startsWith(separator, pos)) {
        // check consecutive separators
        if (lastPartIsSeparator) {
          if (rejectInvalid) return rejectedActionOutput;
          data.consecutiveSeparatorIndex.push(pos);
        }
        // check leading separator
        if (pos === input.start + 2) {
          if (rejectInvalid) return rejectedActionOutput;
          data.leadingSeparator = true;
        }

        lastPartIsSeparator = true;
        pos += separator.length;
        continue;
      }

      // check content
      const contentMatch = contentMatcher.exec(input, pos);
      if (contentMatch.accept) {
        data.value += input.buffer.slice(pos, pos + contentMatch.digested);
        pos += contentMatch.digested;
        lastPartIsSeparator = false;
        continue;
      }

      const suffixMatch = suffixChecker.exec(input, pos);
      // check suffix
      if (suffixMatch.accept) {
        // check tailing separator
        if (lastPartIsSeparator) {
          if (rejectInvalid) return rejectedActionOutput;
          data.tailingSeparator = true;
        }

        pos += suffixMatch.digested;
      }

      // otherwise
      break;
    }

    // check tailing separator
    if (lastPartIsSeparator) {
      if (rejectInvalid) return rejectedActionOutput;
      data.tailingSeparator = true;
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
) {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0b",
    content: /[01]/,
    acceptInvalid: options?.acceptInvalid,
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
) {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0o",
    content: /[0-7]/,
    acceptInvalid: options?.acceptInvalid,
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
) {
  return integerLiteral<ActionState, ErrorType>({
    prefix: "0x",
    content: /[0-9a-fA-F]/,
    acceptInvalid: options?.acceptInvalid,
    separator: options?.separator,
    suffix: options?.suffix,
  });
}
