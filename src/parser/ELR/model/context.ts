import { ILexer } from "../../../lexer";
import { ASTNode, ASTNodeQuerySelector } from "../../ast";

/** Parser context for ELR parsers. */
export interface ParserContext<T> {
  readonly matched: readonly ASTNode<T>[];
  readonly before: readonly ASTNode<T>[];
  readonly after: string;
  /** Find AST node by its type name. */
  readonly $: ASTNodeQuerySelector<T>;
  readonly lexer: ILexer;
  /** Data of the result AST node. */
  data?: T;
  error?: any;
}

/** Will be called if the current grammar is accepted. */
export type Callback<T> = (context: ParserContext<T>) => void;

export type Condition<T> = (context: ParserContext<T>) => boolean;
