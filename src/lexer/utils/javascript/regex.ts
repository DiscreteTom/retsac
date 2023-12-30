import { tryOrDefault } from "../../../helper";
import { Action, rejectedActionOutput } from "../../action";

export type RegexLiteralData = {
  /**
   * The value of the regex literal.
   * This will try to be parsed even if the literal is invalid.
   */
  value: RegExp;
  /**
   * `undefined` if the numeric literal valid.
   */
  invalid?: {
    /**
     * `true` if reach the end of the input buffer or a line break before the regex literal is terminated.
     */
    unterminated: boolean;
    /**
     * The index of the whole input string where the invalid flag is located.
     */
    flags: number[];
  };
};

/**
 * Return an action that matches JavaScript regex literal.
 */
export function regexLiteral<ActionState = never, ErrorType = never>(): Action<
  { kind: never; data: RegexLiteralData },
  ActionState,
  ErrorType
> {
  // ref: https://github.com/microsoft/TypeScript/blob/efc9c065a2caa52c5bebd08d730eed508075a78a/src/compiler/scanner.ts#L2369
  return Action.exec<RegexLiteralData, ActionState, ErrorType>((input) => {
    // check prefix
    if (input.buffer[input.start] !== "/") return rejectedActionOutput;

    // scan for content, not include the suffix `/`
    const text = input.buffer;
    let pos = input.start + 1;
    let unterminated = false;
    let inEscape = false;
    let inCharacterClass = false;
    while (true) {
      // check end of text
      if (pos >= text.length) {
        unterminated = true;
        break;
      }

      const ch = text.charCodeAt(pos);

      // check line break
      // ref: https://github.com/microsoft/TypeScript/blob/efc9c065a2caa52c5bebd08d730eed508075a78a/src/compiler/scanner.ts#L557
      if (ch === 0x0a || ch === 0x0d || ch === 0x2028 || ch === 0x2029) {
        unterminated = true;
        break;
      }

      if (inEscape) {
        // Parsing an escape character;
        // reset the flag and just advance to the next char.
        inEscape = false;
      } else if (ch === /* CharacterCodes.slash */ 0x2f && !inCharacterClass) {
        // A slash within a character class is permissible,
        // but in general it signals the end of the regexp literal.
        break;
      } else if (ch === /* CharacterCodes.openBracket */ 0x5b) {
        inCharacterClass = true;
      } else if (ch === /* CharacterCodes.backslash */ 0x5c) {
        inEscape = true;
      } else if (ch === /* CharacterCodes.closeBracket */ 0x5d) {
        inCharacterClass = false;
      }

      pos++;
    }

    const source = input.buffer.slice(input.start, pos);
    if (!unterminated) pos++; // eat the suffix `/`

    // scan for flags
    const flagsStart = pos;
    while (pos < text.length && text[pos].match(/[a-zA-Z]/) !== null) {
      pos++;
    }
    const rawFlags = input.buffer.slice(flagsStart, pos);
    const flags = rawFlags
      .split("")
      .filter((c) => c.match(/dgimsuvy/) !== null)
      .join("");

    const invalid: NonNullable<RegexLiteralData["invalid"]> = {
      unterminated,
      flags: rawFlags
        .split("")
        .map((c, i) => (c.match(/dgimsuvy/) === null ? flagsStart + i : -1))
        .filter((i) => i !== -1),
    };

    return {
      accept: true,
      content: input.buffer.slice(input.start, pos),
      data: {
        value: tryOrDefault(() => new RegExp(source, flags), new RegExp("")),
        invalid:
          invalid.unterminated || invalid.flags.length > 0
            ? invalid
            : undefined,
      },
      digested: pos - input.start,
      muted: false,
    };
  });
}
