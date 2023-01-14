import { ASTNode } from "../../ast";

export interface ParserContext<T> {
  readonly matched: ASTNode<T>[];
  readonly before: ASTNode<T>[];
  readonly after: ASTNode<T>[];
  /** Data of the result AST node. */
  data?: T;
  error?: any;
}

/** Will be called if the current grammar is accepted. */
export type Callback<T> = (context: ParserContext<T>) => void;

/** Grammar rejecter. Return `true` to reject to use the current grammar. */
export type Rejecter<T> = (context: ParserContext<T>) => boolean;
