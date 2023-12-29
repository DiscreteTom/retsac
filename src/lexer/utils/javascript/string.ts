import type { AcceptedActionDecoratorContext, Action } from "../../action";
import type {
  EscapeHandler,
  StringLiteralData as CommonStringLiteralData,
  EscapeInfo,
} from "../string";
import { commonEscapeHandlers, stringLiteral } from "../string";
import { codepoint, fallback, hex, unicode } from "../string/handler";

/**
 * Evaluate a JavaScript string literal just like `eval`.
 * The caller should make sure the string is well-formed.
 * Interpolation is not supported.
 * @example
 * evalString(`"\\n"`) // => "\n"
 * evalString(`'\\n'`) // => "\n"
 * evalString('`\\n`') // => "\n"
 */
export function evalString(quoted: string) {
  return evalStringContent(quoted.slice(1, -1));
}

/**
 * Evaluate a JavaScript string literal content just like `eval`.
 * The caller should make sure the string is well-formed.
 * @example
 * evalStringContent('\\n') // => "\n"
 * evalStringContent('`\\n${'.slice(1, -2)) // => "\n"
 */
export function evalStringContent(content: string) {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#literals
  // IMPORTANT! all escaped chars should be searched simultaneously!
  // e.g. you should NOT use `unquoted.replace(/\\\\/g, "\\").replace(/\\'/g, "'")...`
  return content.replace(
    /(\\0|\\'|\\"|\\n|\\\\|\\r|\\v|\\t|\\b|\\f|\\\n|\\`|\\x(?:[0-9a-fA-F]{2})|\\u(?:[0-9a-fA-F]{4})|\\u\{(?:[0-9a-fA-F]{1,6})\})/g,
    (match) => {
      switch (match) {
        case `\\0`:
          return "\0";
        case `\\'`:
          return "'";
        case `\\"`:
          return '"';
        case `\\n`:
          return "\n";
        case `\\\\`:
          return "\\";
        case `\\r`:
          return "\r";
        case `\\v`:
          return "\v";
        case `\\t`:
          return "\t";
        case `\\b`:
          return "\b";
        case `\\f`:
          return "\f";
        case `\\\n`:
          return "";
        case "\\`":
          return "`";
        default: {
          if (match.startsWith("\\x")) {
            return String.fromCharCode(parseInt(match.slice(2), 16));
          } else if (match.startsWith("\\u{")) {
            return String.fromCodePoint(parseInt(match.slice(3, -1), 16));
          } else {
            // match.startsWith("\\u")
            return String.fromCharCode(parseInt(match.slice(2), 16));
          }
        }
      }
    },
  );
}

export const escapeHandlerFactory = {
  /**
   * JavaScript's simple escape sequences.
   * ```
   * { b: "\b", t: "\t", n: "\n", v: "\v", f: "\f", r: "\r", '"': '"', "'": "'", "\\": "\\", "0": "\0" }
   * ```
   */
  simple(): EscapeHandler<never> {
    return commonEscapeHandlers.map({
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
      "0": "\0",
    });
  },
  /**
   * JavaScript's line continuation rules.
   * ```
   * ["\r\n", '\n', '\u2028', '\u2029']
   * ```
   */
  lineContinuation(): EscapeHandler<never> {
    return commonEscapeHandlers.lineContinuation([
      // ref: https://github.com/microsoft/TypeScript/blob/6c0687e493e23bfd054bf9ae1fc37a7cb75229ad/src/compiler/scanner.ts#L1600
      "\r\n",
      "\n",
      "\u2028", // CharacterCodes.lineSeparator
      "\u2029", // CharacterCodes.paragraphSeparator
    ]);
  },
};

export const escapeHandlers = [
  escapeHandlerFactory.simple(),
  escapeHandlerFactory.lineContinuation(),
  hex({ error: "hex" }),
  // make sure to handle codepoint before unicode
  // since codepoint's prefix is longer than unicode's and has overlap
  codepoint({ error: "codepoint" }),
  unicode({ error: "unicode" }),
  // keep the fallback handler at the end for error handling
  fallback(),
] as const;

export type StringLiteralData<StringLiteralErrorKinds extends string> = {
  /**
   * `undefined` if the string literal is valid.
   */
  invalid?: {
    escapes: EscapeInfo<StringLiteralErrorKinds>[];
  } & Pick<CommonStringLiteralData<StringLiteralErrorKinds>, "unclosed">;
} & Pick<CommonStringLiteralData<StringLiteralErrorKinds>, "value" | "escapes">;

/**
 * Transform {@link CommonStringLiteralData} to {@link StringLiteralData}.
 */
export function stringLiteralDataMapper<
  StringLiteralErrorKinds extends string,
  ActionState,
  ErrorType,
>({
  input: _,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonStringLiteralData<StringLiteralErrorKinds> },
  ActionState,
  ErrorType
>): StringLiteralData<StringLiteralErrorKinds> {
  const invalid: NonNullable<
    StringLiteralData<StringLiteralErrorKinds>["invalid"]
  > = {
    unclosed: output.data.unclosed,
    escapes: output.data.escapes.filter((e) => e.error !== undefined),
  };

  return {
    value: output.data.value,
    escapes: output.data.escapes,
    invalid:
      invalid.escapes.length > 0 || invalid.unclosed ? invalid : undefined,
  };
}

export function singleQuoteStringLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: StringLiteralData<
      | "hex"
      | "unicode"
      | "codepoint"
      | "unnecessary"
      | "unterminated"
      | "unhandled"
    >;
  },
  ActionState,
  ErrorType
> {
  return stringLiteral<
    "hex" | "unicode" | "codepoint" | "unnecessary",
    ActionState,
    ErrorType
  >("'", {
    escape: { handlers: escapeHandlers },
  }).data(stringLiteralDataMapper);
}

export function doubleQuoteStringLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: StringLiteralData<
      | "hex"
      | "unicode"
      | "codepoint"
      | "unnecessary"
      | "unterminated"
      | "unhandled"
    >;
  },
  ActionState,
  ErrorType
> {
  return stringLiteral<
    "hex" | "unicode" | "codepoint" | "unnecessary",
    ActionState,
    ErrorType
  >('"', {
    escape: { handlers: escapeHandlers },
  }).data(stringLiteralDataMapper);
}

/**
 * Match a JavaScript simple string literal (single quote or double quote).
 * Legacy octal escape sequences are not supported.
 *
 * Single quote and double quote are matched at the same time to optimize performance.
 */
export function simpleStringLiteral<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: StringLiteralData<
      | "hex"
      | "unicode"
      | "codepoint"
      | "unnecessary"
      | "unterminated"
      | "unhandled"
    >;
  },
  ActionState,
  ErrorType
> {
  return stringLiteral<
    "hex" | "unicode" | "codepoint" | "unnecessary",
    ActionState,
    ErrorType
  >(
    (input) =>
      // match single quote or double quote at the same time to optimize performance
      ['"', "'"].includes(input.buffer[input.start])
        ? { accept: true, digested: 1 }
        : { accept: false },
    {
      close: (input, pos) =>
        input.buffer[input.start] === input.buffer[pos]
          ? { accept: true, digested: 1 }
          : { accept: false },
      escape: { handlers: escapeHandlers },
    },
  ).data(stringLiteralDataMapper);
}
