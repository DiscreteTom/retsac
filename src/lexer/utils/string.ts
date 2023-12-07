import { compose } from "@discretetom/r-compose";
import { Action, rejectedActionOutput } from "../action";

/**
 * Match a string literal.
 *
 * Escape (`\`) will be handled correctly for quote, not for the string content,
 * so you have to parse those escaped content by yourself.
 *
 * E.g. `stringLiteral('"')` will match `"abc\"def"` and return `"abc\"def"`.
 *
 * Set `multiline: true` to allow multiline string literals.
 */
export function _stringLiteral<ActionState = never, ErrorType = never>(
  /** The open quote. */
  open: string,
  options?: {
    /** The close quote. Equals to the open quote by default. */
    close?: string;
    /** @default false */
    multiline?: boolean;
    /** @default true */
    escape?: boolean;
    /**
     * If `true`, unclosed string(`\n` or EOF for single line string, and EOF for multiline string)
     * will also be accepted and marked as `{ unclosed: true }` in `output.data`.
     * @default true
     */
    acceptUnclosed?: boolean;
    /**
     * If `true`, the string literal can be continued by `\` at the end of each line(`\\\n`),
     * even if `multiline` is `false`.
     *
     * The returned content will contains the `\\\n`, you have to process it by yourself.
     *
     * This option is effective even `options.escape` is `false`.
     * @default true
     */
    lineContinuation?: boolean;
  },
): Action<
  {
    kind: never;
    data: {
      /**
       * If `true`, the string literal is unclosed (`\n` or EOF for single line string, and EOF for multiline string).
       */
      unclosed: boolean;
    };
  },
  ActionState,
  ErrorType
> {
  const close = options?.close ?? open;
  const multiline = options?.multiline ?? false;
  const escaped = options?.escape ?? true;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const lineContinuation = options?.lineContinuation ?? true;

  const action = Action.from<never, undefined, ActionState, ErrorType>(
    compose(
      ({ concat, any, select, lookahead, escape, not }) =>
        concat(
          // match open quote
          escape(open),
          // match content
          any(
            escaped
              ? select(
                  lineContinuation ? /\\\n/ : "", // line continuation is treated as part of the content
                  /\\./, // any escaped character is treated as part of the content
                  not(
                    // any character except the following is treated as part of the content
                    concat(
                      /\\/, // standalone backslash shouldn't be treated as part of the content
                      multiline ? "" : /\n/, // if not multiline, `\n` shouldn't be treated as part of the content
                    ),
                  ),
                )
              : select(
                  lineContinuation ? /\\\n/ : "", // line continuation is treated as part of the content
                  /./, // any non-newline character is treated as part of the content
                  multiline ? /\n/ : "", // if multiline, `\n` should be treated as part of the content
                ),
            // since we use `/./` in the content, we need to make sure it doesn't match the close quote
            { greedy: false },
          ),
          // match close quote
          acceptUnclosed
            ? select(
                escape(close),
                "$", // unclosed string is acceptable, so EOF is acceptable
                multiline
                  ? "" // if multiline is enabled, we don't treat `\n` as the close quote
                  : lookahead(/\n/), // use lookahead so we don't include the `\n` in the result
              )
            : escape(close), // unclosed string is not accepted, so we only accept the close quote
        ),
      // DON'T set the `m` flag, because we want to match the whole string literal when `multiline` is true
      // if we set the `m` flag, the `$` will match the end of each line, instead of the end of the whole string literal
    ),
  ).data(() => ({ unclosed: false }));

  // set unclosed
  if (acceptUnclosed) {
    return action.data(({ output }) => ({
      unclosed: !output.content.split(/\\./).at(-1)!.endsWith(close),
    }));
  }

  // else, not accept unclosed
  return action;
}

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

// TODO: better name
export type StringLiteralCondition = (
  buffer: string,
  start: number,
) =>
  | {
      accept: true;
      digested: number;
    }
  | { accept: false };

export function stringLiteral<ActionState = never, ErrorType = never>(
  /**
   * The open quote.
   */
  open: string | StringLiteralCondition,
  options?: {
    /**
     * The close quote.
     * Equals to the open quote by default.
     */
    close?: string | StringLiteralCondition;
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
      handlers?: EscapeHandler[];
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
  const openMatcher = typeof open === "string" ? string2matcher(open) : open;
  const closeMatcher =
    options?.close === undefined
      ? openMatcher // defaults to the open quote
      : typeof options.close === "string"
      ? string2matcher(options.close)
      : options.close;
  const multiline = options?.multiline ?? false;
  const acceptUnclosed = options?.acceptUnclosed ?? true;
  const escapeEnabled = options?.escape !== undefined;
  const escapeStarter = options?.escape?.starter ?? "\\";
  const escapeHandlers = options?.escape?.handlers ?? [];

  return Action.exec((input) => {
    // match open quote
    const matchOpen = openMatcher(input.buffer, input.start);
    if (!matchOpen.accept) return rejectedActionOutput;

    const text = input.buffer;
    const end = input.buffer.length;

    let start = input.start;
    let pos = input.start + matchOpen.digested; // eat the open quote
    let value = "";
    let unclosed = false;
    const escapes = [] as EscapeInfo[];

    while (true) {
      // check for unterminated string
      if (pos >= end) {
        if (!acceptUnclosed) return rejectedActionOutput;

        value += text.substring(start, pos);
        unclosed = true;
        break;
      }

      // check for close quote
      const matchClose = closeMatcher(text, pos);
      if (matchClose.accept) {
        value += text.substring(start, pos);
        pos += matchClose.digested; // eat the close quote
        break;
      }

      // handle escape
      if (escapeEnabled) {
        if (text.startsWith(escapeStarter, pos)) {
          let gotEscape = false;
          for (const handle of escapeHandlers) {
            const starter = { index: pos, length: escapeStarter.length };
            const res = handle(text, starter);
            if (res.accept) {
              escapes.push({
                starter,
                value: res.value,
                length: res.length,
                errors: res.errors,
              });
              value += res.value;
              pos += res.length;
              start = pos;
              gotEscape = true;
              break; // only accept the first accepted handler
            }
          }

          // skip `pos++` below since we've already updated `pos`
          if (gotEscape) continue;

          // else, no escape handler accepted, treat the escape starter as a normal character
          // TODO: record an error?
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
        if (multiline) {
          value += text.substring(start, pos);
        } else {
          if (!acceptUnclosed) return rejectedActionOutput;

          value += text.substring(start, pos);
          unclosed = true;
          break;
        }
      }
      pos++;
    }

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      data: {
        value,
        unclosed,
        escapes,
      },
      digested: pos - input.start,
      muted: false,
    };
  });
}

function string2matcher(s: string): StringLiteralCondition {
  return (buffer, start) =>
    buffer.startsWith(s, start)
      ? { accept: true, digested: s.length }
      : { accept: false };
}
