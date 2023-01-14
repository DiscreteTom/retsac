import { ASTNode } from "./ast";

export type ParserOutput<T> =
  | { accept: false }
  | {
      accept: true;
      /** Result AST nodes. */
      buffer: ASTNode<T>[];
      /** Empty if no error. */
      errors: ASTNode<T>[];
    };

export type ParseExec<T> = (
  input?: string,
  stopOnError?: boolean
) => ParserOutput<T>;

export interface IParser<T> {
  /** Reset state. */
  reset(): this;
  /** Clone a new parser with the same states. */
  clone(): IParser<T>;
  /** Clone a new parser without states. */
  dryClone(): IParser<T>;
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
