import type {
  AcceptedActionDecoratorContext,
  Action,
  EnhancedActionOutput,
} from "../../action";
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
} as const;

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

export type StringLiteralData<EscapeErrorKinds extends string> = {
  /**
   * `undefined` if the string literal is valid.
   */
  invalid?: {
    escapes: EscapeInfo<EscapeErrorKinds>[];
  } & Pick<CommonStringLiteralData<EscapeErrorKinds>, "unclosed">;
} & Pick<CommonStringLiteralData<EscapeErrorKinds>, "value" | "escapes">;

/**
 * Transform {@link CommonStringLiteralData} to {@link StringLiteralData}.
 */
export function stringLiteralDataMapper<
  EscapeErrorKinds extends string,
  ActionState,
  ErrorType,
>({
  input: _,
  output,
}: AcceptedActionDecoratorContext<
  { kind: never; data: CommonStringLiteralData<EscapeErrorKinds> },
  ActionState,
  ErrorType
>): StringLiteralData<EscapeErrorKinds> {
  const invalid: NonNullable<StringLiteralData<EscapeErrorKinds>["invalid"]> = {
    unclosed: output.data.unclosed,
    escapes: output.data.escapes.filter((e) => e.error !== undefined),
  };

  return {
    value: output.data.value,
    escapes: output.data.escapes,
    invalid:
      invalid.unclosed || invalid.escapes.length > 0 ? invalid : undefined,
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
      ['"', "'"].includes(input.buffer[input.start]) ? 1 : undefined,
    {
      close: (input, pos) =>
        input.buffer[input.start] === input.buffer[pos] ? 1 : undefined,
      escape: { handlers: escapeHandlers },
    },
  ).data(stringLiteralDataMapper);
}

export type TemplateStringLiteralKinds = "simple" | "start" | "middle" | "end";

export type TemplateStringLiteralData<
  EscapeErrorKinds extends string,
  LiteralKinds extends TemplateStringLiteralKinds,
> = {
  /**
   * `undefined` if the string literal is valid.
   */
  invalid?: {
    escapes: EscapeInfo<EscapeErrorKinds>[];
  } & Pick<CommonStringLiteralData<EscapeErrorKinds>, "unclosed">;
  /**
   * - `simple` means `` `123` ``
   * - `start` means `` `123${ ``
   * - `middle` means `` }123${ ``
   * - `end` means `` }123` ``
   */
  kind: LiteralKinds;
} & Pick<CommonStringLiteralData<EscapeErrorKinds>, "value" | "escapes">;

function templateStringLiteralDataMapperFactory<
  LiteralKinds extends TemplateStringLiteralKinds,
  EscapeErrorKinds extends string,
  ActionState,
  ErrorType,
>(
  kindMapper: (
    output: EnhancedActionOutput<
      never,
      CommonStringLiteralData<EscapeErrorKinds>,
      ErrorType
    >,
  ) => LiteralKinds,
) {
  return function ({
    input: _,
    output,
  }: AcceptedActionDecoratorContext<
    { kind: never; data: CommonStringLiteralData<EscapeErrorKinds> },
    ActionState,
    ErrorType
  >): TemplateStringLiteralData<EscapeErrorKinds, LiteralKinds> {
    const invalid: NonNullable<
      TemplateStringLiteralData<EscapeErrorKinds, LiteralKinds>["invalid"]
    > = {
      unclosed: output.data.unclosed,
      escapes: output.data.escapes.filter((e) => e.error !== undefined),
    };

    return {
      // ref: https://github.com/microsoft/TypeScript/blob/d027e9619fb8ca964df3885a536a67b5f813738b/src/compiler/scanner.ts#L1427
      // Speculated ECMAScript 6 Spec 11.8.6.1:
      // <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for Template Values
      value: output.data.value.replace(/\r\n/g, "\n"),
      escapes: output.data.escapes,
      invalid:
        invalid.unclosed || invalid.escapes.length > 0 ? invalid : undefined,
      kind: kindMapper(output),
    };
  };
}

/**
 * Transform {@link CommonStringLiteralData} to {@link TemplateStringLiteralData}.
 */
export function templateStringLiteralLeftDataMapperFactory<
  EscapeErrorKinds extends string,
  ActionState,
  ErrorType,
>() {
  return templateStringLiteralDataMapperFactory<
    "simple" | "start",
    EscapeErrorKinds,
    ActionState,
    ErrorType
  >((output) =>
    output.data.unclosed || output.content.endsWith("`") ? "simple" : "start",
  );
}

/**
 * Transform {@link CommonStringLiteralData} to {@link TemplateStringLiteralData}.
 */
export function templateStringLiteralRightDataMapperFactory<
  EscapeErrorKinds extends string,
  ActionState,
  ErrorType,
>() {
  return templateStringLiteralDataMapperFactory<
    "middle" | "end",
    EscapeErrorKinds,
    ActionState,
    ErrorType
  >((output) =>
    output.data.unclosed || output.content.endsWith("`") ? "end" : "middle",
  );
}

/**
 * Escape handlers for template string literals.
 */
export const templateEscapeHandlers = [
  escapeHandlerFactory.simple(),
  escapeHandlerFactory.lineContinuation(),
  hex({ error: "hex" }),
  // make sure to handle codepoint before unicode
  // since codepoint's prefix is longer than unicode's and has overlap
  codepoint({ error: "codepoint" }),
  unicode({ error: "unicode" }),
  // `\$` is a valid escape sequence in template string literal
  commonEscapeHandlers.map({ $: "$" }),
  // keep the fallback handler at the end for error handling
  fallback(),
] as const;

/**
 * Match a JavaScript template string literal left part (`` `123` `` or `` `123${ ``).
 */
export function templateStringLiteralLeft<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: TemplateStringLiteralData<
      | "hex"
      | "codepoint"
      | "unicode"
      | "unnecessary"
      | "unterminated"
      | "unhandled",
      "start" | "simple"
    >;
  },
  ActionState,
  ErrorType
> {
  return stringLiteral<
    "hex" | "unicode" | "codepoint" | "unnecessary",
    ActionState,
    ErrorType
  >("`", {
    close: /`|\${/,
    multiline: true,
    escape: { handlers: templateEscapeHandlers },
  }).data(templateStringLiteralLeftDataMapperFactory());
}

/**
 * Match a JavaScript template string literal right part (`` }123` `` or `` }123${ ``).
 */
export function templateStringLiteralRight<
  ActionState = never,
  ErrorType = never,
>(): Action<
  {
    kind: never;
    data: TemplateStringLiteralData<
      | "hex"
      | "codepoint"
      | "unicode"
      | "unnecessary"
      | "unterminated"
      | "unhandled",
      "middle" | "end"
    >;
  },
  ActionState,
  ErrorType
> {
  return stringLiteral<
    "hex" | "unicode" | "codepoint" | "unnecessary",
    ActionState,
    ErrorType
  >("}", {
    close: /`|\${/,
    multiline: true,
    escape: { handlers: templateEscapeHandlers },
  }).data(templateStringLiteralRightDataMapperFactory());
}
