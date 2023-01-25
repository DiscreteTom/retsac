import { ASTNode } from "../../ast";

/** Base parser context for LR and ELR parsers. */
export interface BaseParserContext<T, After> {
  readonly matched: readonly ASTNode<T>[];
  readonly before: readonly ASTNode<T>[];
  /** For LR parser, `after` is `ASTNode[]`. For ELR parser, `after` is `string`. */
  readonly after: After;
  /** Data of the result AST node. */
  data?: T;
  error?: any;
  $(name: string, index?: number): ASTNode<T> | undefined;
}

/** Will be called if the current grammar is accepted. */
export type Callback<T, After, Ctx extends BaseParserContext<T, After>> = (
  context: Ctx
) => void;

/** Grammar rejecter. Return `true` to reject to use the current grammar. */
export type Rejecter<T, After, Ctx extends BaseParserContext<T, After>> = (
  context: Ctx
) => boolean;
