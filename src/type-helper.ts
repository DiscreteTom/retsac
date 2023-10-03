export type AtLeastOneOf<T, Keys extends keyof T = keyof T> = {
  [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];

// https://stackoverflow.com/questions/61047551/typescript-union-of-string-and-string-literals
export type StringOrLiteral<T extends string> =
  | (string & NonNullable<unknown>) // same as `(string & {})`
  | T;

/**
 * A quoted string literal type.
 * E.g. `"abc"`, `'abc'`
 */
export type QuotedString = `"${string}"` | `'${string}'`; // TODO: handle escape?
