import { Action } from "./action";

/** The output of a lexer. */
export interface Token {
  /** User-defined type name. */
  type: string;
  /** Text content. */
  content: string;
  /** Start position of input string. */
  start: number;
  /** Error message. `null` if no error. */
  error?: any;
}

/** Apply `action` and try to yield a token with `type`. */
export interface Definition {
  /** Target token type. Empty string if anonymous. */
  type: string;
  action: Action;
}
