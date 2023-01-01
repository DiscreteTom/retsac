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
  buffer: ASTNode<T>[],
  stopOnError?: boolean
) => ParserOutput<T>;

export interface IParser<T> {
  parse: ParseExec<T>;
  reset: () => IParser<T>;
}
