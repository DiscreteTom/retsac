import { Action, rejectedActionOutput } from "../action";

export function binaryIntegerLiteral<
  ActionState = never,
  ErrorType = never,
>(options?: {
  /**
   * If `undefined`, the numeric separator will be disabled.
   * @default undefined
   */
  separator?: string;
  /**
   * @default undefined
   */
  suffix?:
    | string
    | ((
        buffer: string,
        start: number,
      ) => { accept: false } | { accept: true; digested: number });
  /**
   * If `true`, common invalid numeric literals will also be accepted and marked in `output.data` with `{ invalid: true }`.
   * @default true
   */
  acceptInvalid?: boolean;
}) {
  const rejectInvalid = !(options?.acceptInvalid ?? true);
  const separator = options?.separator;
  const suffix = options?.suffix;
  const suffixChecker =
    suffix === undefined
      ? () => ({ accept: true as const, digested: 0 })
      : typeof suffix === "string"
      ? (buffer: string, start: number) =>
          buffer.startsWith(suffix, start)
            ? { accept: true as const, digested: suffix.length }
            : { accept: false as const }
      : suffix;

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
    // ensure the input starts with '0b'
    if (!input.buffer.startsWith("0b", input.start))
      return rejectedActionOutput;

    const data = {
      value: "",
      empty: false,
      leadingSeparator: false,
      tailingSeparator: false,
      consecutiveSeparatorIndex: [] as number[],
    };

    // check content and separators
    let lastPartIsSeparator = false;
    let pos = input.start + 2;
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
      if (["0", "1"].includes(input.buffer[pos])) {
        pos++;
        lastPartIsSeparator = false;
        data.value += input.buffer[pos];
        continue;
      }

      const suffixMatch = suffixChecker(input.buffer, pos);
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
