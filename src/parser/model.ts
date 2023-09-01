import { Logger } from "../model";
import { ASTNode } from "./ast";

export type AcceptedParserOutput<T> = {
  accept: true;
  /**
   * Current AST nodes.
   */
  buffer: readonly ASTNode<T>[];
  /**
   * Empty list if no error.
   */
  errors: readonly ASTNode<T>[]; // TODO: newly added?
};

export const rejectedParserOutput = Object.freeze({ accept: false });

export type ParserOutput<T> =
  | typeof rejectedParserOutput
  | AcceptedParserOutput<T>;

/**
 * The `input` will be fed to the lexer.
 */
export type ParseExec<T> = (
  // TODO: what's the error?
  input?: string | { input?: string; stopOnError?: boolean }
) => ParserOutput<T>;

// TODO: default T
export interface IParser<T> {
  debug: boolean;
  logger: Logger;
  /**
   * Reset state.
   */
  reset(): this;
  /**
   * Clone a new parser with the same states.
   */
  clone(options?: { debug?: boolean; logger?: Logger }): IParser<T>;
  /**
   * Clone a new parser without states.
   */
  dryClone(options?: { debug?: boolean; logger?: Logger }): IParser<T>;
  /**
   * Feed a string to the lexer.
   */
  feed(input: string): this;
  /**
   * Try to yield an entry NT.
   * Stop when the first entry NT is reduced.
   */
  readonly parse: ParseExec<T>;
  /**
   * Try to reduce till the parser can't accept more.
   * This is useful if your entry NT can also be reduced by other rules.
   */
  readonly parseAll: ParseExec<T>;
  /**
   * Get error AST nodes.
   */
  getErrors(): readonly ASTNode<T>[];
  hasErrors(): boolean;
  /**
   * Current AST nodes.
   */
  getNodes(): readonly ASTNode<T>[]; // TODO: rename to buffer
  /**
   * Take the first AST node.
   */
  take(): ASTNode<T> | undefined; // TODO: take N
}
