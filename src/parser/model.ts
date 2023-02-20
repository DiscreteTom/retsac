import { ASTNode } from "./ast";
import { LR_RuntimeError } from "./ELR/error";

export type ParserOutput<T> =
  | { accept: false }
  | {
      accept: true;
      /** Result AST nodes. */
      buffer: readonly ASTNode<T>[];
      /** Empty if no error. */
      errors: readonly ASTNode<T>[];
    };

export type ParseExec<T> = (
  input?: string | { input?: string; stopOnError?: boolean }
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

export type Traverser<T> = (self: ASTNode<T>) => T | void;

export function defaultTraverser<T>(self: ASTNode<T>): T | void {
  if (self.children !== undefined) {
    // if there is only one child, use its data or traverse to get its data
    if (self.children.length == 1)
      return self.children![0].data ?? self.children![0].traverse();
    // if there are multiple children, traverse all, don't return anything
    self.children.forEach((c) => c.traverse());
  } else {
    // if there is no children, this node is a T and the traverse should not be called
    throw LR_RuntimeError.traverserNotDefined();
  }
}
