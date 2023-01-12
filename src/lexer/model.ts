import { Action } from "./action";

/** The output of a lexer. */
export interface Token {
  /** User-defined type name. */
  type: string;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  error?: any;
}

/** Apply `action` and try to yield a token with `type`. */
export interface Definition {
  /** Target token type. Empty string if anonymous. */
  type: string;
  action: Action;
}

export interface ILexer {
  reset(): ILexer;
  feed(input: string): ILexer;
  lex(
    input?: string | { input?: string; expect?: Readonly<Set<string>> }
  ): Token | null;
  lexAll(input?: string, stopOnError?: boolean): Token[];
}
