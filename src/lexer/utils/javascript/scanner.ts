import { CharacterCodes } from "./types";

export enum ScannerErrorKind {
  UnterminatedStringLiteral,
  UnexpectedEndOfText,
  OctalEscapeSequencesAreNotAllowed,
  EscapeSequenceIsNotAllowed,
  HexadecimalDigitExpected,
  AnExtendedUnicodeEscapeValueMustBeBetween_0x0_And_0x10FFFF_Inclusive,
  UnterminatedUnicodeEscapeSequence,
  MultipleConsecutiveNumericSeparatorsAreNotPermitted,
  NumericSeparatorsAreNotAllowedHere,
}

export interface ScannerErrorInfo {
  kind: ScannerErrorKind;
  pos: number;
  length: number;
}

/**
 * @see https://github.com/microsoft/TypeScript/blob/ef6ac03df4db7a61034908ffe08ba0ff5a1601ba/src/compiler/scanner.ts#L1464
 */
export function createScanner(onError: (info: ScannerErrorInfo) => void) {
  let text: string;
  // Current position (end position of text of current token)
  let pos: number;
  // end of text
  let end: number;

  return {
    reset(newText: string, newPos: number) {
      text = newText;
      pos = newPos;
      end = text.length;
      // tokenFlags = TokenFlags.None;
    },
    /**
     * Return the evaluated string value. Errors will be correctly handled.
     */
    scanString,
  };

  // function error(message: DiagnosticMessage): void;
  // function error(
  //   message: DiagnosticMessage,
  //   errPos: number,
  //   length: number,
  //   arg0?: any,
  // ): void;
  // function error(
  //   message: DiagnosticMessage,
  //   errPos: number = pos,
  //   length?: number,
  //   arg0?: any,
  // ): void {
  //   if (onError) {
  //     const oldPos = pos;
  //     pos = errPos;
  //     onError(message, length || 0, arg0);
  //     pos = oldPos;
  //   }
  // }
  function error(
    kind: ScannerErrorKind,
    errPos: number = pos,
    length?: number,
  ) {
    onError({ kind, pos: errPos, length: length || 0 });
  }

  function scanString(jsxAttributeString = false): {
    /**
     * The evaluated string value. Errors will be correctly handled.
     */
    value: string;
    end: number;
  } {
    const quote = text.charCodeAt(pos);
    pos++;
    let result = "";
    let start = pos;
    while (true) {
      if (pos >= end) {
        result += text.substring(start, pos);
        // tokenFlags |= TokenFlags.Unterminated;
        // error(Diagnostics.Unterminated_string_literal);
        error(ScannerErrorKind.UnterminatedStringLiteral);
        break;
      }
      const ch = text.charCodeAt(pos);
      if (ch === quote) {
        result += text.substring(start, pos);
        pos++;
        break;
      }
      if (ch === CharacterCodes.backslash && !jsxAttributeString) {
        result += text.substring(start, pos);
        result += scanEscapeSequence(/*shouldEmitInvalidEscapeError*/ true);
        start = pos;
        continue;
      }

      if (
        (ch === CharacterCodes.lineFeed ||
          ch === CharacterCodes.carriageReturn) &&
        !jsxAttributeString
      ) {
        result += text.substring(start, pos);
        // tokenFlags |= TokenFlags.Unterminated;
        // error(Diagnostics.Unterminated_string_literal);
        error(ScannerErrorKind.UnterminatedStringLiteral);
        break;
      }
      pos++;
    }
    return { value: result, end: pos };
  }

  // Extract from Section A.1
  // EscapeSequence ::
  //     | CharacterEscapeSequence
  //     | 0 (?![0-9])
  //     | LegacyOctalEscapeSequence
  //     | NonOctalDecimalEscapeSequence
  //     | HexEscapeSequence
  //     | UnicodeEscapeSequence
  // LegacyOctalEscapeSequence ::=
  //     | '0' (?=[89])
  //     | [1-7] (?![0-7])
  //     | [0-3] [0-7] (?![0-7])
  //     | [4-7] [0-7]
  //     | [0-3] [0-7] [0-7]
  // NonOctalDecimalEscapeSequence ::= [89]
  function scanEscapeSequence(shouldEmitInvalidEscapeError?: boolean): string {
    const start = pos;
    pos++;
    if (pos >= end) {
      // error(Diagnostics.Unexpected_end_of_text);
      error(ScannerErrorKind.UnexpectedEndOfText);
      return "";
    }
    const ch = text.charCodeAt(pos);
    pos++;
    switch (ch) {
      case CharacterCodes._0:
        // Although '0' preceding any digit is treated as LegacyOctalEscapeSequence,
        // '\08' should separately be interpreted as '\0' + '8'.
        if (pos >= end || !isDigit(text.charCodeAt(pos))) {
          return "\0";
        }
      // '\01', '\011'
      // falls through
      case CharacterCodes._1:
      case CharacterCodes._2:
      case CharacterCodes._3:
        // '\1', '\17', '\177'
        if (pos < end && isOctalDigit(text.charCodeAt(pos))) {
          pos++;
        }
      // '\17', '\177'
      // falls through
      case CharacterCodes._4:
      case CharacterCodes._5:
      case CharacterCodes._6:
      case CharacterCodes._7:
        // '\4', '\47' but not '\477'
        if (pos < end && isOctalDigit(text.charCodeAt(pos))) {
          pos++;
        }
        // '\47'
        // tokenFlags |= TokenFlags.ContainsInvalidEscape;
        if (shouldEmitInvalidEscapeError) {
          const code = parseInt(text.substring(start + 1, pos), 8);
          // error(
          //   Diagnostics.Octal_escape_sequences_are_not_allowed_Use_the_syntax_0,
          //   start,
          //   pos - start,
          //   "\\x" + code.toString(16).padStart(2, "0"),
          // );
          error(
            ScannerErrorKind.OctalEscapeSequencesAreNotAllowed,
            start,
            pos - start,
          );
          return String.fromCharCode(code);
        }
        return text.substring(start, pos);
      case CharacterCodes._8:
      case CharacterCodes._9:
        // the invalid '\8' and '\9'
        // tokenFlags |= TokenFlags.ContainsInvalidEscape;
        if (shouldEmitInvalidEscapeError) {
          // error(
          //   Diagnostics.Escape_sequence_0_is_not_allowed,
          //   start,
          //   pos - start,
          //   text.substring(start, pos),
          // );
          error(
            ScannerErrorKind.EscapeSequenceIsNotAllowed,
            start,
            pos - start,
          );
          return String.fromCharCode(ch);
        }
        return text.substring(start, pos);
      case CharacterCodes.b:
        return "\b";
      case CharacterCodes.t:
        return "\t";
      case CharacterCodes.n:
        return "\n";
      case CharacterCodes.v:
        return "\v";
      case CharacterCodes.f:
        return "\f";
      case CharacterCodes.r:
        return "\r";
      case CharacterCodes.singleQuote:
        return "'";
      case CharacterCodes.doubleQuote:
        return '"';
      case CharacterCodes.u:
        if (pos < end && text.charCodeAt(pos) === CharacterCodes.openBrace) {
          // '\u{DDDDDDDD}'
          pos++;
          const escapedValueString = scanMinimumNumberOfHexDigits(
            1,
            /*canHaveSeparators*/ false,
          );
          const escapedValue = escapedValueString
            ? parseInt(escapedValueString, 16)
            : -1;
          // '\u{Not Code Point' or '\u{CodePoint'
          if (escapedValue < 0) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(Diagnostics.Hexadecimal_digit_expected);
              error(ScannerErrorKind.HexadecimalDigitExpected);
            }
            return text.substring(start, pos);
          }
          if (!isCodePoint(escapedValue)) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(
              //   Diagnostics.An_extended_Unicode_escape_value_must_be_between_0x0_and_0x10FFFF_inclusive,
              // );
              error(
                ScannerErrorKind.AnExtendedUnicodeEscapeValueMustBeBetween_0x0_And_0x10FFFF_Inclusive,
              );
            }
            return text.substring(start, pos);
          }
          if (pos >= end) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(Diagnostics.Unexpected_end_of_text);
              error(ScannerErrorKind.UnexpectedEndOfText);
            }
            return text.substring(start, pos);
          }
          if (text.charCodeAt(pos) !== CharacterCodes.closeBrace) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(Diagnostics.Unterminated_Unicode_escape_sequence);
              error(ScannerErrorKind.UnterminatedUnicodeEscapeSequence);
            }
            return text.substring(start, pos);
          }
          pos++;
          // tokenFlags |= TokenFlags.ExtendedUnicodeEscape;
          return utf16EncodeAsString(escapedValue);
        }
        // '\uDDDD'
        for (; pos < start + 6; pos++) {
          if (!(pos < end && isHexDigit(text.charCodeAt(pos)))) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(Diagnostics.Hexadecimal_digit_expected);
              error(ScannerErrorKind.HexadecimalDigitExpected);
            }
            return text.substring(start, pos);
          }
        }
        // tokenFlags |= TokenFlags.UnicodeEscape;
        return String.fromCharCode(
          parseInt(text.substring(start + 2, pos), 16),
        );

      case CharacterCodes.x:
        // '\xDD'
        for (; pos < start + 4; pos++) {
          if (!(pos < end && isHexDigit(text.charCodeAt(pos)))) {
            // tokenFlags |= TokenFlags.ContainsInvalidEscape;
            if (shouldEmitInvalidEscapeError) {
              // error(Diagnostics.Hexadecimal_digit_expected);
              error(ScannerErrorKind.HexadecimalDigitExpected);
            }
            return text.substring(start, pos);
          }
        }
        // tokenFlags |= TokenFlags.HexEscape;
        return String.fromCharCode(
          parseInt(text.substring(start + 2, pos), 16),
        );

      // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
      // the line terminator is interpreted to be "the empty code unit sequence".
      case CharacterCodes.carriageReturn:
        if (pos < end && text.charCodeAt(pos) === CharacterCodes.lineFeed) {
          pos++;
        }
      // falls through
      case CharacterCodes.lineFeed:
      case CharacterCodes.lineSeparator:
      case CharacterCodes.paragraphSeparator:
        return "";
      default:
        return String.fromCharCode(ch);
    }
  }

  /**
   * Scans as many hexadecimal digits as are available in the text,
   * returning "" if the given number of digits was unavailable.
   */
  function scanMinimumNumberOfHexDigits(
    count: number,
    canHaveSeparators: boolean,
  ): string {
    return scanHexDigits(
      /*minCount*/ count,
      /*scanAsManyAsPossible*/ true,
      canHaveSeparators,
    );
  }

  function scanHexDigits(
    minCount: number,
    scanAsManyAsPossible: boolean,
    canHaveSeparators: boolean,
  ): string {
    let valueChars: number[] = [];
    let allowSeparator = false;
    let isPreviousTokenSeparator = false;
    while (valueChars.length < minCount || scanAsManyAsPossible) {
      let ch = text.charCodeAt(pos);
      if (canHaveSeparators && ch === CharacterCodes._) {
        // tokenFlags |= TokenFlags.ContainsSeparator;
        if (allowSeparator) {
          allowSeparator = false;
          isPreviousTokenSeparator = true;
        } else if (isPreviousTokenSeparator) {
          // error(
          //   Diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted,
          //   pos,
          //   1,
          // );
          error(
            ScannerErrorKind.MultipleConsecutiveNumericSeparatorsAreNotPermitted,
            pos,
            1,
          );
        } else {
          // error(Diagnostics.Numeric_separators_are_not_allowed_here, pos, 1);
          error(ScannerErrorKind.NumericSeparatorsAreNotAllowedHere, pos, 1);
        }
        pos++;
        continue;
      }
      allowSeparator = canHaveSeparators;
      if (ch >= CharacterCodes.A && ch <= CharacterCodes.F) {
        ch += CharacterCodes.a - CharacterCodes.A; // standardize hex literals to lowercase
      } else if (
        !(
          (ch >= CharacterCodes._0 && ch <= CharacterCodes._9) ||
          (ch >= CharacterCodes.a && ch <= CharacterCodes.f)
        )
      ) {
        break;
      }
      valueChars.push(ch);
      pos++;
      isPreviousTokenSeparator = false;
    }
    if (valueChars.length < minCount) {
      valueChars = [];
    }
    if (text.charCodeAt(pos - 1) === CharacterCodes._) {
      // error(Diagnostics.Numeric_separators_are_not_allowed_here, pos - 1, 1);
      error(ScannerErrorKind.NumericSeparatorsAreNotAllowedHere, pos - 1, 1);
    }
    return String.fromCharCode(...valueChars);
  }
}

function isDigit(ch: number): boolean {
  return ch >= CharacterCodes._0 && ch <= CharacterCodes._9;
}

function isOctalDigit(ch: number): boolean {
  return ch >= CharacterCodes._0 && ch <= CharacterCodes._7;
}

function isHexDigit(ch: number): boolean {
  return (
    isDigit(ch) ||
    (ch >= CharacterCodes.A && ch <= CharacterCodes.F) ||
    (ch >= CharacterCodes.a && ch <= CharacterCodes.f)
  );
}

function isCodePoint(code: number): boolean {
  return code <= 0x10ffff;
}

function utf16EncodeAsString(codePoint: number) {
  return String.fromCodePoint(codePoint);
}
