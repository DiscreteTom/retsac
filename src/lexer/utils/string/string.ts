import { Action, rejectedActionOutput } from "../../action";
import { str2subAction, type SubAction } from "../common";
import type { EscapeHandler, EscapeInfo } from "./escape";
import * as commonEscapeHandlers from "./handler";

export function stringLiteral<
  ErrorKinds extends string = never,
  ActionState = never,
  ErrorType = never,
>(
  /**
   * The open quote.
   */
  open: string | SubAction<ActionState>,
  options?: {
    /**
     * The close quote.
     * Equals to the open quote by default.
     */
    close?: string | SubAction<ActionState>;
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
  const openMatcher = typeof open === "string" ? str2subAction(open) : open;
  const closeMatcher =
    options?.close === undefined
      ? openMatcher // defaults to the open quote
      : typeof options.close === "string"
      ? str2subAction(options.close)
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
