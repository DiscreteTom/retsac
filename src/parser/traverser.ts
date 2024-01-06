import type { GeneralToken } from "../lexer";
import type { NTNode } from "./ast";

/**
 * Traverser is called when a top-down traverse is performed.
 * The result of the traverser is stored in the ASTNode's data field.
 *
 * Only NT nodes can have custom traversers, since T nodes are created by tokens instead of grammar rules.
 */
export type NTNodeTraverser<
  Kind extends NTs,
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = (
  self: NTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
) => ASTData | undefined | void;

/**
 * The default NT node traverser.
 */
export function defaultNTNodeTraverser<
  Kind extends NTs,
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
>(
  self: NTNode<Kind, NTs, ASTData, ErrorType, TokenType, Global>,
): ASTData | undefined | void {
  // if there is only one child, use its data or traverse to get its data
  if (self.children.length === 1)
    return self.children[0].data ?? self.children[0].traverse();

  // otherwise (no children or multiple children), traverse all, don't return anything
  self.children.forEach((c) => c.traverse());
}
