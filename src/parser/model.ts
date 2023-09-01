import { Logger } from "../model";
import { ASTNode } from "./ast";

export type ParserAcceptedOutput<T> = {
  accept: true;
  /** Result AST nodes. */
  buffer: readonly ASTNode<T>[];
  /** Empty list if no error. */
  errors: readonly ASTNode<T>[];
};

export const parserRejectedOutput = Object.freeze({ accept: false });

export type ParserOutput<T> =
  | typeof parserRejectedOutput
  | ParserAcceptedOutput<T>;

export type ParseExec<T> = (
  input?: string | { input?: string; stopOnError?: boolean }
) => ParserOutput<T>;

export interface IParser<T> {
  debug: boolean;
  logger: Logger;
  /** Reset state. */
  reset(): this;
  /** Clone a new parser with the same states. */
  clone(options?: { debug?: boolean; logger?: Logger }): IParser<T>;
  /** Clone a new parser without states. */
  dryClone(options?: { debug?: boolean; logger?: Logger }): IParser<T>;
  /** Feed a string to the lexer. */
  feed(input: string): this;
  /** Try to yield an entry NT. */
  parse: ParseExec<T>;
  /** Try to reduce till the parser can't accept more. */
  parseAll: ParseExec<T>;
  /** Get error AST nodes. */
  getErrors(): readonly ASTNode<T>[];
  hasErrors(): boolean;
  /** Get all reduced AST nodes. */
  getNodes(): readonly ASTNode<T>[];
  /** Take the first AST node. */
  take(): ASTNode<T> | undefined;
}
