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
  hex(options?: {
    /**
     * Accept even if the hexadecimal part is invalid.
     * @default true
     */
    acceptInvalid?: boolean;
  }): EscapeHandler<"hex"> {
    const acceptInvalid = options?.acceptInvalid ?? true;

    return (buffer, starter) => {
      const contentStart = starter.index + starter.length;

      // ensure the escape content starts with `x`
      if (buffer[contentStart] !== "x") return { accept: false };
      // ensure the buffer is long enough
      if (buffer.length < contentStart + 3) {
        if (acceptInvalid)
          return {
            accept: true,
            value: buffer.slice(contentStart),
            length: buffer.length - contentStart,
            error: "hex",
          };
        return { accept: false };
      }

      const hex = buffer.slice(contentStart + 1, contentStart + 3);
      if (hex.match(/[^0-9a-fA-F]/)) {
        if (acceptInvalid)
          return {
            accept: true,
            value: hex,
            length: 3,
            error: "hex",
          };
        return { accept: false };
      }

      return {
        accept: true,
        value: String.fromCharCode(parseInt(hex, 16)),
        length: 3,
      };
    };
  },
  /**
   * Accept one character as the escaped value and mark the escape as unnecessary.
   * E.g. eval `'\\z'` to `'z'`.
   */
  fallback(): EscapeHandler<"unnecessary"> {
    return (buffer, starter) => {
      return {
        accept: true,
        value: buffer[starter.index + starter.length],
        length: 1,
        error: "unnecessary",
      };
    };
  },
};
