import { Logger } from "../model";
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

export type LexerBuildOptions = {
  debug?: boolean;
  logger?: Logger;
};

export interface ILexer {
  debug: boolean;
  logger: Logger;
  reset(): this;
  /**
   * Clone a new lexer with the same state and definitions.
   * If `options.debug` is omitted, the new lexer will inherit the debug flag from the original one.
   */
  clone(options?: { debug?: boolean }): ILexer;
  /**
   * Clone a new lexer with the same definitions, without states.
   * If `options.debug` is omitted, the new lexer will have debug disabled.
   */
  dryClone(options?: { debug?: boolean }): ILexer;
  /** Append buffer with input. */
  feed(input: string): this;
  /** How many chars are digested. */
  get digested(): number;
  /**
   * Take `n` chars from the rest of buffer and update state.
   * This is useful when you have external logic to handle the token.
   */
  take(n?: number): string;
  /**
   * Try to retrieve a token. If nothing match, return `null`.
   *
   * You can provide `expect` to limit the token type/content to be accepted.
   */
  lex(
    input?:
      | string
      | Readonly<{
          input?: string;
          expect?: Readonly<{
            type?: string;
            text?: string;
          }>;
        }>
  ): Token | null;
  /**
   * Try to retrieve a token list exhaustively.
   */
  lexAll(input?: string | { input?: string; stopOnError?: boolean }): Token[];
  /**
   * Remove ignored chars from the start of the rest of buffer.
   */
  trimStart(input?: string): this;
  /**
   * Get the un-lexed string buffer.
   */
  getRest(): string;
  /**
   * The rest of buffer not empty.
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
