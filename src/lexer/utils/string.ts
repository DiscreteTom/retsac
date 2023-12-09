import type { ActionInput } from "../action";
import { Action, rejectedActionOutput } from "../action";

export type EscapeStarterInfo = {
  /**
   * The index of the start of the escape starter in the buffer.
   */
  index: number;
  /**
   * The length of the escape starter.
   */
  length: number;
};

export type EscapeInfo<ErrorKinds extends string> = {
  starter: Readonly<EscapeStarterInfo>;
  /**
   * The evaluated string value. Errors should be correctly handled.
   */
  value: string;
  /**
   * The length of the whole escape sequence, including the escape starter.
   */
  length: number;
  /**
   * `undefined` if no error.
   */
  error?: ErrorKinds;
};

export type EscapeHandlerOutput<ErrorKinds extends string> =
  | { accept: false }
  | ({
      accept: true;
      /**
       * The length of the escaped content, not include the escape starter.
       */
      length: number;
    } & Pick<EscapeInfo<ErrorKinds>, "value" | "error">);

export type EscapeHandler<ErrorKinds extends string> = (
  /**
   * The whole input text.
   *
   * `buffer.length` must be greater than `starter.index + starter.length`,
   * so it's safe to access `buffer[starter.index + starter.length]`.
   */
  buffer: string,
  starter: Readonly<EscapeStarterInfo>,
) => EscapeHandlerOutput<ErrorKinds>;

/**
 * Decide whether to digest some chars as a quote.
 */
export type QuoteCondition<ActionState> = (
  input: ActionInput<ActionState>,
  /**
   * Index of the next char to be read.
   *
   * For the open quote, `pos` equals to `input.start`.
   */
  pos: number,
) =>
  | {
      accept: true;
      /**
       * How many chars are digested by the quote.
       */
      digested: number;
    }
  | { accept: false };

export function stringLiteral<
  ErrorKinds extends string = never,
  ActionState = never,
  ErrorType = never,
  // TODO: customizable error kind
>(
  /**
   * The open quote.
   */
  open: string | QuoteCondition<ActionState>,
  options?: {
    /**
     * The close quote.
     * Equals to the open quote by default.
     */
    close?: string | QuoteCondition<ActionState>;
    /**
     * @default false
     */
    multiline?: boolean;
    /**
     * If `undefined`, escape will not be handled.
     * @default undefined
     */
    escape?: {
      /**
       * @default '\\'
       */
      starter?: string;
      /**
       * @default []
       */
      handlers?:
        | EscapeHandler<ErrorKinds>[]
        | ((
            common: typeof commonEscapeHandlers,
          ) => EscapeHandler<ErrorKinds>[]);
    };
    /**
     * If `true`, unclosed strings
     * will also be accepted and marked as `{ unclosed: true }` in `output.data`.
     * @default true
     */
    acceptUnclosed?: boolean;
  },
): Action<
  {
    kind: never;
    data: {
      /**
       * The evaluated string value. Errors will be correctly handled.
       */
      value: string;
      /**
       * If `true`, the string literal is unclosed (`\n` or EOF for single line string, and EOF for multiline string).
       */
      unclosed: boolean;
      escapes: EscapeInfo<ErrorKinds | "unterminated" | "unhandled">[];
    };
  },
  ActionState,
  ErrorType
> {
  const openMatcher =
    typeof open === "string" ? string2quoteCondition(open) : open;
  const closeMatcher =
    options?.close === undefined
      ? openMatcher // defaults to the open quote
      : typeof options.close === "string"
      ? string2quoteCondition(options.close)
      : options.close;
  const multiline = options?.multiline ?? false;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const escapeEnabled = options?.escape !== undefined;
  const escapeStarter = options?.escape?.starter ?? "\\";
  const rawEscapeHandlers = options?.escape?.handlers ?? [];
  const escapeHandlers =
    rawEscapeHandlers instanceof Array
      ? rawEscapeHandlers
      : rawEscapeHandlers(commonEscapeHandlers);

  return Action.exec((input) => {
    // match open quote
    const matchOpen = openMatcher(input, input.start);
    if (!matchOpen.accept) return rejectedActionOutput;

    const text = input.buffer;
    const end = input.buffer.length;

    /**
     * Index of the next char to be read.
     */
    let pos = input.start + matchOpen.digested; // eat the open quote
    /**
     * The start index of the next value fragment.
     */
    let start = pos;
    /**
     * The data to be returned.
     */
    const data = {
      value: "",
      unclosed: false,
      escapes: [] as EscapeInfo<ErrorKinds | "unterminated" | "unhandled">[],
    };

    while (true) {
      // check for unterminated string
      if (pos >= end) {
        if (!acceptUnclosed) return rejectedActionOutput;

        data.value += text.substring(start, pos);
        data.unclosed = true;
        break;
      }

      // check for close quote
      const matchClose = closeMatcher(input, pos);
      if (matchClose.accept) {
        data.value += text.substring(start, pos);
        pos += matchClose.digested; // eat the close quote
        break;
      }

      // handle escape
      if (escapeEnabled) {
        if (text.startsWith(escapeStarter, pos)) {
          // append string value before the escape
          data.value += text.substring(start, pos);
          start = pos;

          const starter = { index: pos, length: escapeStarter.length };

          // handle unterminated
          if (pos + starter.length >= end) {
            data.escapes.push({
              starter,
              length: starter.length,
              value: escapeStarter, // treat the escape starter as a normal string
              error: "unterminated",
            });
            data.value += escapeStarter;
            data.unclosed = true;
            pos += starter.length;
            break;
          }

          let gotEscape = false;
          for (const handle of escapeHandlers) {
            const res = handle(text, starter);
            if (res.accept) {
              data.escapes.push({
                starter,
                value: res.value,
                length: starter.length + res.length,
                error: res.error,
              });
              data.value += res.value;
              pos += starter.length + res.length;
              start = pos;
              gotEscape = true;
              break; // only accept the first accepted handler
            }
          }

          // skip `pos++` below since we've already updated `pos`
          if (gotEscape) continue;

          // else, no escape handler accepted, record an error
          // treat the escape starter as a normal string
          data.value += escapeStarter;
          data.escapes.push({
            starter,
            value: escapeStarter,
            length: starter.length,
            error: "unhandled",
          });
          pos += starter.length;
          start = pos;
          continue;
        }
      }

      // handle newline
      const ch = text.charCodeAt(pos);
      if (
        ch === /* CharacterCodes.lineFeed */ 10 ||
        ch === /* CharacterCodes.carriageReturn */ 13
      ) {
        if (!multiline) {
          if (!acceptUnclosed) return rejectedActionOutput;

          data.value += text.substring(start, pos);
          data.unclosed = true;
          break;
        }
        // else, multiline, just eat the char
      }

      // by default, just eat the char
      pos++;
    }

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      data,
      digested: pos - input.start,
      muted: false,
    };
  });
}

function string2quoteCondition<ActionState>(
  s: string,
): QuoteCondition<ActionState> {
  return (input, pos) =>
    input.buffer.startsWith(s, pos)
      ? { accept: true, digested: s.length }
      : { accept: false };
}

export const commonEscapeHandlers = {
  /**
   * Map escape sequences to their corresponding values.
   * @example
   * // eval `'\\n'` to `'\n'`
   * map({ n: '\n' })
   */
  map(mapper: Record<string, string>): EscapeHandler<never> {
    return (buffer, starter) => {
      const contentStart = starter.index + starter.length;
      for (const raw in mapper) {
        if (buffer.startsWith(raw, contentStart)) {
          return {
            accept: true,
            value: mapper[raw],
            length: raw.length,
          };
        }
      }
      return { accept: false };
    };
  },
  /**
   * Treat these escape sequences as empty string.
   * @example
   * // eval `'\\\r\n'` and `'\\\n'` to `''`
   * lineContinuation(['\r\n', '\n'])
   */
  lineContinuation(newline: string[]): EscapeHandler<never> {
    const mapper = {} as Record<string, string>;
    newline.forEach((nl) => (mapper[nl] = ""));
    return commonEscapeHandlers.map(mapper);
  },
  /**
   * Handle hex escape sequence (`\xDD`).
   */
  hex<ErrorKinds extends string = "hex">(options?: {
    /**
     * The prefix of the escape sequence.
     * @default 'x'
     */
    prefix?: string;
    /**
     * The length of the hexadecimal part.
     * @default 2
     */
    hexLength?: number;
    /**
     * Accept even if the hexadecimal part is invalid.
     * @default true
     */
    acceptInvalid?: boolean; // TODO: rename to rejectInvalid?
    /**
     * The error kind.
     * @default 'hex'
     */
    error?: ErrorKinds;
  }): EscapeHandler<ErrorKinds> {
    const prefix = options?.prefix ?? "x";
    const hexLength = options?.hexLength ?? 2;
    const acceptInvalid = options?.acceptInvalid ?? true;
    const error = options?.error ?? ("hex" as ErrorKinds);

    return (buffer, starter) => {
      const contentStart = starter.index + starter.length;

      // ensure the escape content starts with prefix
      if (!buffer.startsWith(prefix, contentStart)) return { accept: false };
      // ensure the buffer is long enough
      if (buffer.length < contentStart + prefix.length + hexLength) {
        if (acceptInvalid)
          return {
            accept: true,
            value: buffer.slice(contentStart),
            length: buffer.length - contentStart,
            error,
          };
        return { accept: false };
      }

      const hex = buffer.slice(
        contentStart + prefix.length,
        contentStart + prefix.length + hexLength,
      );
      if (hex.match(/[^0-9a-fA-F]/)) {
        if (acceptInvalid)
          return {
            accept: true,
            value: hex,
            length: prefix.length + hexLength,
            error,
          };
        return { accept: false };
      }

      return {
        accept: true,
        value: String.fromCharCode(parseInt(hex, 16)),
        length: prefix.length + hexLength,
      };
    };
  },
  /**
   * Handle unicode escape sequence (`\uDDDD`).
   */
  unicode<ErrorKinds extends string = "unicode">(options?: {
    /**
     * The prefix of the escape sequence.
     * @default 'u'
     */
    prefix?: string;
    /**
     * The length of the hexadecimal part.
     * @default 4
     */
    hexLength?: number;
    /**
     * Accept even if the hexadecimal part is invalid.
     * @default true
     */
    acceptInvalid?: boolean;
    /**
     * The error kind.
     * @default 'unicode'
     */
    error?: ErrorKinds;
  }): EscapeHandler<ErrorKinds> {
    const error = options?.error ?? ("unicode" as ErrorKinds);
    return commonEscapeHandlers.hex({
      prefix: options?.prefix ?? "u",
      hexLength: options?.hexLength ?? 4,
      acceptInvalid: options?.acceptInvalid ?? true,
      error,
    });
  },
  /**
   * Handle unicode code point escape sequence (`\u{DDDDDD}`).
   */
  codepoint<ErrorKinds extends string = "codepoint">(options?: {
    /**
     * The prefix of the escape sequence.
     * @default 'u{'
     */
    prefix?: string;
    /**
     * The suffix of the escape sequence.
     * @default '}'
     */
    suffix?: string;
    /**
     * The maximum length of the hexadecimal part.
     * @default 6
     */
    maxHexLength?: number;
    /**
     * Accept even if the hexadecimal part is invalid.
     * @default true
     */
    acceptInvalid?: boolean;
    /**
     * The error kind.
     * @default 'codepoint'
     */
    error?: ErrorKinds;
  }): EscapeHandler<ErrorKinds> {
    const prefix = options?.prefix ?? "u{";
    const suffix = options?.suffix ?? "}";
    const maxHexLength = options?.maxHexLength ?? 6;
    const acceptInvalid = options?.acceptInvalid ?? true;
    const error = options?.error ?? ("codepoint" as ErrorKinds);
    const hexRegex = new RegExp(`[0-9a-fA-F]{1,${maxHexLength}}`, "y");

    return (buffer, starter) => {
      const contentStart = starter.index + starter.length;

      // ensure the escape content starts with prefix
      if (!buffer.startsWith(prefix, contentStart)) return { accept: false };

      // use regex to match the hex part
      // don't use regex to match the suffix to avoid too far lookahead
      hexRegex.lastIndex = contentStart + prefix.length;
      const hexMatch = hexRegex.exec(buffer);
      if (!hexMatch) {
        if (buffer.startsWith(suffix, contentStart + prefix.length)) {
          // no hex content, has suffix
          if (acceptInvalid)
            return {
              accept: true,
              value: "",
              length: prefix.length + suffix.length,
              error,
            };
          return { accept: false };
        }
        // else, no hex content, no suffix
        if (acceptInvalid)
          return {
            accept: true,
            value: "",
            length: prefix.length,
            error,
          };
        return { accept: false };
      }

      // else, hex exists, check if it is valid
      const escapedValue = parseInt(hexMatch[0], 16);
      if (escapedValue > 0x10ffff) {
        if (acceptInvalid) {
          // invalid hex, check suffix
          if (
            buffer.startsWith(
              suffix,
              contentStart + prefix.length + hexMatch.length,
            )
          ) {
            return {
              accept: true,
              value: hexMatch[0],
              length: prefix.length + hexMatch[0].length + suffix.length,
              error,
            };
          }
          // else, no suffix
          return {
            accept: true,
            value: hexMatch[0],
            length: prefix.length + hexMatch[0].length,
            error,
          };
        }
        // else, reject invalid
        return { accept: false };
      }
      // else, valid hex exists, check suffix
      const value = String.fromCodePoint(parseInt(hexMatch[0], 16));
      if (
        buffer.startsWith(
          suffix,
          contentStart + prefix.length + hexMatch.length,
        )
      ) {
        return {
          accept: true,
          value,
          length: prefix.length + hexMatch[0].length + suffix.length,
        };
      }
      // else, suffix not exists
      if (acceptInvalid)
        return {
          accept: true,
          value,
          length: prefix.length + hexMatch[0].length,
        };
      return { accept: false };
    };
  },
  /**
   * Accept one character as the escaped value and mark the escape as unnecessary.
   * E.g. treat `'\\z'` as `'z'`.
   */
  fallback<ErrorKinds extends string = "unnecessary">(options?: {
    /**
     * The error kind.
     * @default 'unnecessary'
     */
    error?: ErrorKinds;
  }): EscapeHandler<ErrorKinds> {
    const error = options?.error ?? ("unnecessary" as ErrorKinds);
    return (buffer, starter) => {
      return {
        accept: true,
        value: buffer[starter.index + starter.length],
        length: 1,
        error,
      };
    };
  },
};
