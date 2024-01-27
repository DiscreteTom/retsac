import type { GeneralTokenDataBinding } from "./token";

export type ExtractKinds<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["kind"];

export type ExtractData<DataBindings extends GeneralTokenDataBinding> =
  DataBindings["data"];

/**
 * Extract the token type from a lexer.
 */
export type ExtractToken<
  Lexer extends { lex: (...args: never[]) => { token: unknown } }, // TODO: optimize typing?
> = NonNullable<ReturnType<Lexer["lex"]>["token"]>;
