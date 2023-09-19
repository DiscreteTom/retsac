import type { StringOrLiteral } from "../type-helper";
import type { ASTNode } from "./ast";

/**
 * Select children nodes by the name.
 */
export type ASTNodeChildrenSelector<
  ASTData,
  ErrorType,
  AllKinds extends string,
> = (
  name: StringOrLiteral<AllKinds>,
) => ASTNode<ASTData, ErrorType, AllKinds>[];

/**
 * Select the first matched child node by the name.
 */
export type ASTNodeFirstMatchChildSelector<
  ASTData,
  ErrorType,
  AllKinds extends string,
> = (
  name: StringOrLiteral<AllKinds>,
) => ASTNode<ASTData, ErrorType, AllKinds> | undefined;

/**
 * Select from the given nodes by the name.
 */
export type ASTNodeSelector<ASTData, ErrorType, AllKinds extends string> = (
  name: StringOrLiteral<AllKinds>,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
) => ASTNode<ASTData, ErrorType, AllKinds>[];

/**
 * Select the first matched node from the given nodes by the name.
 */
export type ASTNodeFirstMatchSelector<
  ASTData,
  ErrorType,
  AllKinds extends string,
> = (
  name: StringOrLiteral<AllKinds>,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
) => ASTNode<ASTData, ErrorType, AllKinds> | undefined;

export function defaultASTNodeSelector<
  ASTData,
  ErrorType,
  AllKinds extends string,
>(
  name: StringOrLiteral<AllKinds>,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
) {
  return nodes.filter((n) => n.name === name);
}

export function defaultASTNodeFirstMatchSelector<
  ASTData,
  ErrorType,
  AllKinds extends string,
>(
  name: StringOrLiteral<AllKinds>,
  nodes: readonly ASTNode<ASTData, ErrorType, AllKinds>[],
) {
  return nodes.find((c) => c.name == name);
}
