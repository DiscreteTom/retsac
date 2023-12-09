import type { EscapeHandler } from "./escape";

/**
 * Map escape sequences to their corresponding values.
 * @example
 * // eval `'\\n'` to `'\n'`
 * map({ n: '\n' })
 */
export function map(mapper: Record<string, string>): EscapeHandler<never> {
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
}

/**
 * Treat these escape sequences as empty string.
 * @example
 * // eval `'\\\r\n'` and `'\\\n'` to `''`
 * lineContinuation(['\r\n', '\n'])
 */
export function lineContinuation(newline: string[]): EscapeHandler<never> {
  const mapper = {} as Record<string, string>;
  newline.forEach((nl) => (mapper[nl] = ""));
  return map(mapper);
}

/**
 * Handle hex escape sequence (`\xDD`).
 */
export function hex<ErrorKinds extends string = never>(options?: {
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
   * The error kind.
   *
   * If set, invalid escape will be accepted and marked with this error.
   *
   * If `undefined`, invalid escape will be rejected.
   * @default undefined
   */
  error?: ErrorKinds;
}): EscapeHandler<ErrorKinds> {
  const prefix = options?.prefix ?? "x";
  const hexLength = options?.hexLength ?? 2;
  const error = options?.error;

  return (buffer, starter) => {
    const contentStart = starter.index + starter.length;

    // ensure the escape content starts with prefix
    if (!buffer.startsWith(prefix, contentStart)) return { accept: false };
    // ensure the buffer is long enough
    if (buffer.length < contentStart + prefix.length + hexLength) {
      if (error === undefined) return { accept: false };
      return {
        accept: true,
        value: buffer.slice(contentStart),
        length: buffer.length - contentStart,
        error,
      };
    }

    const hex = buffer.slice(
      contentStart + prefix.length,
      contentStart + prefix.length + hexLength,
    );
    if (hex.match(/[^0-9a-fA-F]/)) {
      if (error === undefined) return { accept: false };
      return {
        accept: true,
        value: hex,
        length: prefix.length + hexLength,
        error,
      };
    }

    return {
      accept: true,
      value: String.fromCharCode(parseInt(hex, 16)),
      length: prefix.length + hexLength,
    };
  };
}

/**
 * Handle unicode escape sequence (`\uDDDD`).
 */
export function unicode<ErrorKinds extends string = never>(options?: {
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
   * The error kind.
   *
   * If set, invalid escape will be accepted and marked with this error.
   *
   * If `undefined`, invalid escape will be rejected.
   * @default undefined
   */
  error?: ErrorKinds;
}): EscapeHandler<ErrorKinds> {
  const error = options?.error;
  return hex({
    prefix: options?.prefix ?? "u",
    hexLength: options?.hexLength ?? 4,
    error,
  });
}

/**
 * Handle unicode code point escape sequence (`\u{DDDDDD}`).
 */
export function codepoint<ErrorKinds extends string = never>(options?: {
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
   * The error kind.
   *
   * If set, invalid escape will be accepted and marked with this error.
   *
   * If `undefined`, invalid escape will be rejected.
   * @default undefined
   */
  error?: ErrorKinds;
}): EscapeHandler<ErrorKinds> {
  const prefix = options?.prefix ?? "u{";
  const suffix = options?.suffix ?? "}";
  const maxHexLength = options?.maxHexLength ?? 6;
  const error = options?.error;
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
      // no hex content
      if (error === undefined) return { accept: false };

      // check suffix
      if (buffer.startsWith(suffix, contentStart + prefix.length)) {
        // no hex content, has suffix
        return {
          accept: true,
          value: "",
          length: prefix.length + suffix.length,
          error,
        };
      }
      // else, no hex content, no suffix
      return {
        accept: true,
        value: "",
        length: prefix.length,
        error,
      };
    }

    // else, hex exists, check if it is valid
    const escapedValue = parseInt(hexMatch[0], 16);
    if (escapedValue > 0x10ffff) {
      if (error === undefined) return { accept: false };
      // invalid hex, check suffix
      if (
        buffer.startsWith(
          suffix,
          contentStart + prefix.length + hexMatch[0].length,
        )
      ) {
        // invalid hex, suffix exists
        return {
          accept: true,
          value: hexMatch[0],
          length: prefix.length + hexMatch[0].length + suffix.length,
          error,
        };
      }
      // else, invalid hex, no suffix
      return {
        accept: true,
        value: hexMatch[0],
        length: prefix.length + hexMatch[0].length,
        error,
      };
    }
    // else, valid hex exists, check suffix
    const value = String.fromCodePoint(escapedValue);
    if (
      !buffer.startsWith(
        suffix,
        contentStart + prefix.length + hexMatch[0].length,
      )
    ) {
      if (error === undefined) return { accept: false };
      return {
        accept: true,
        value,
        length: prefix.length + hexMatch[0].length,
        error,
      };
    }
    return {
      accept: true,
      value,
      length: prefix.length + hexMatch[0].length + suffix.length,
    };
  };
}

/**
 * Accept one character as the escaped value and mark the escape as unnecessary.
 * E.g. treat `'\\z'` as `'z'`.
 */
export function fallback<ErrorKinds extends string = "unnecessary">(options?: {
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
}
