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
  reset(): this;
  /** Clone a new lexer with the same state. */
  clone(): ILexer;
  /** Clone a new lexer with the same definitions. */
  dryClone(): ILexer;
  /** Append buffer with input. */
  feed(input: string): this;
  /** How many chars are digested. */
  get digested(): number;
  /**
   * Take `n` chars from buffer and update state.
   */
  take(n?: number): string;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token types/content to be accepted.
   */
  lex(
    input?:
      | string
      | Readonly<{
          input?: string;
          expect?: Readonly<{
            types?: ReadonlySet<string> | readonly string[];
            text?: string;
          }>;
        }>
  ): Token | null;
  /**
   * Try to retrieve a token list.
   */
  lexAll(input?: string, stopOnError?: boolean): Token[];
  /**
   * Remove ignored chars from the start of the buffer.
   */
  trimStart(input?: string): this;
  /**
   * Get the rest string buffer.
   */
  getRest(): string;
  /**
   * Buffer not empty.
   */
  hasRest(): boolean;
  /**
   * Get all defined token types.
   */
  getTokenTypes(): Set<string>;
  /**
   * Get how many chars in each line.
   */
  getLineChars(): readonly number[];
  /**
   * Get line number (starts from 1) and column number (starts from 1)
   * from the index (starts from 0) of the input string.
   */
  getPos(index: number): { line: number; column: number };
  /**
   * Get error tokens.
   */
  getErrors(): readonly Token[];
  hasErrors(): boolean;
}
