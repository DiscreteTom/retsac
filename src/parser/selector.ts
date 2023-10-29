import type { ExtractKinds, GeneralToken } from "../lexer";
import type { StringOrLiteral } from "../type-helper";
import type { ASTNode } from "./ast";

/**
 * Select children nodes by the name.
 */
export type ASTNodeChildrenSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
) => ASTNode<ASTData, ErrorType, Kinds, TokenType>[];

/**
 * Select the first matched child node by the name.
 */
export type ASTNodeFirstMatchChildSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
) => ASTNode<ASTData, ErrorType, Kinds, TokenType> | undefined;

/**
 * Select from the given nodes by the name.
 */
export type ASTNodeSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<ASTData, ErrorType, Kinds, TokenType>[],
) => ASTNode<ASTData, ErrorType, Kinds, TokenType>[];

/**
 * Select the first matched node from the given nodes by the name.
 */
export type ASTNodeFirstMatchSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<ASTData, ErrorType, Kinds, TokenType>[],
) => ASTNode<ASTData, ErrorType, Kinds, TokenType> | undefined;

export function defaultASTNodeSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
>(
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<ASTData, ErrorType, Kinds, TokenType>[],
) {
  return nodes.filter((n) => n.name === name);
}

export function defaultASTNodeFirstMatchSelector<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
>(
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<ASTData, ErrorType, Kinds, TokenType>[],
) {
  return nodes.find((c) => c.name == name); // TODO: use strict equal
}
