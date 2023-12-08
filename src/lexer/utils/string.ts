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

export type EscapeInfo = {
  /**
   * The evaluated string value. Errors should be correctly handled.
   */
  value: string;
  starter: Readonly<EscapeStarterInfo>;
  /**
   * The length of the whole escape sequence, including the escape starter.
   */
  length: number;
  errors: {
    /**
     * The index of the whole input text.
     */
    start: number;
    length: number;
  }[];
};

export type EscapeHandlerOutput =
  | { accept: false }
  | ({ accept: true } & Pick<EscapeInfo, "value" | "length" | "errors">);

export type EscapeHandler = (
  /**
   * The whole input text.
   */
  buffer: string,
  starter: Readonly<EscapeStarterInfo>,
) => EscapeHandlerOutput;

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

export function stringLiteral<ActionState = never, ErrorType = never>(
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
        | EscapeHandler[]
        | ((common: typeof commonEscapeHandlers) => EscapeHandler[]);
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
      escapes: EscapeInfo[];
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
      escapes: [] as EscapeInfo[],
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
          const starter = { index: pos, length: escapeStarter.length };
          let gotEscape = false;
          for (const handle of escapeHandlers) {
            const res = handle(text, starter);
            if (res.accept) {
              data.escapes.push({
                starter,
                value: res.value,
                length: res.length,
                errors: res.errors,
              });
              data.value += res.value;
              pos += res.length;
              start = pos;
              gotEscape = true;
              break; // only accept the first accepted handler
            }
          }

          // skip `pos++` below since we've already updated `pos`
          if (gotEscape) continue;

          // else, no escape handler accepted, record an error
          data.escapes.push({
            starter,
            value: "",
            length: starter.length,
            errors: [
              {
                start: starter.index,
                length: starter.length,
              },
            ],
          });
          // treat the escape starter as a normal character
          pos += escapeStarter.length;
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
  lineContinuation(
    /**
     * Newline sequences.
     * @default
     * // JavaScript's line continuation rules
     * ["\r\n", '\n', '\u2028', '\u2029']
     */
    newline?: string[],
  ) {
    const newlineSequences = newline ?? [
      // ref: https://github.com/microsoft/TypeScript/blob/6c0687e493e23bfd054bf9ae1fc37a7cb75229ad/src/compiler/scanner.ts#L1600
      "\r\n",
      "\n",
      "\u2028", // CharacterCodes.lineSeparator
      "\u2029", // CharacterCodes.paragraphSeparator
    ];

    return ((buffer, starter) => {
      const contentStart = starter.index + starter.length;
      for (const nl of newlineSequences) {
        if (buffer.startsWith(nl, contentStart)) {
          return {
            accept: true,
            value: "",
            length: starter.length + nl.length,
          };
        }
      }
      return { accept: false };
    }) as EscapeHandler;
  },
  simple(
    /**
     * A map of escape sequences and their corresponding values.
     * @example
     * { n: '\n' }
     * @default
     * // JavaScript's character escape sequences
     * { b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r", '"': '"', "'": "'", "\\": "\\" }
     */
    mapper?: Record<string, string>,
  ) {
    const newlineSequences = mapper ?? {
      // ref: https://github.com/microsoft/TypeScript/blob/6c0687e493e23bfd054bf9ae1fc37a7cb75229ad/src/compiler/scanner.ts#L1516
      b: "\b",
      t: "\t",
      n: "\n",
      v: "\v",
      f: "\f",
      r: "\r",
      '"': '"',
      "'": "'",
      "\\": "\\",
    };

    return ((buffer, starter) => {
      const contentStart = starter.index + starter.length;
      for (const raw in newlineSequences) {
        if (buffer.startsWith(raw, contentStart)) {
          return {
            accept: true,
            value: newlineSequences[raw],
            length: starter.length + raw.length,
          };
        }
      }
      return { accept: false };
    }) as EscapeHandler;
  },
};
