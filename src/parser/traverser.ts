import type { GeneralToken } from "../lexer";
import type { ASTNode } from "./ast";

/**
 * Traverser is called when a top-down traverse is performed.
 * The result of the traverser is stored in the ASTNode's data field.
 * Traverser should never be called in a leaf node (no children).
 */
// TODO: why never be called in a leaf node?
export type Traverser<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  self: ASTNode<Kinds, ASTData, ErrorType, TokenType> & {
    // ensure children is not undefined
    children: NonNullable<
      ASTNode<Kinds, ASTData, ErrorType, TokenType>["children"]
    >;
  },
) => ASTData | undefined | void;

/**
 * The default traverser.
 */
export function defaultTraverser<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
>(
  self: Parameters<Traverser<Kinds, ASTData, ErrorType, TokenType>>[0],
): ASTData | undefined | void {
  // if there is only one child, use its data or traverse to get its data
  if (self.children.length === 1)
    return self.children[0].data ?? self.children[0].traverse();
  // if there are multiple children, traverse all, don't return anything
  self.children.forEach((c) => c.traverse());
}
