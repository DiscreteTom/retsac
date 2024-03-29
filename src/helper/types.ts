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
 *
 * Escaped sequences are not supported.
 */
export type QuotedString = `"${string}"` | `'${string}'`;

// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
