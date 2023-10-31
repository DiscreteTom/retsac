import type { ExtractKinds, GeneralToken } from "../lexer";
import type { StringOrLiteral } from "../type-helper";
import type { ASTNode } from "./ast";

/**
 * Select children nodes by the name.
 */
export type ASTNodeChildrenSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
) => ASTNode<Kinds, ASTData, ErrorType, TokenType>[];

/**
 * Select the first matched child node by the name.
 */
export type ASTNodeFirstMatchChildSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
) => ASTNode<Kinds, ASTData, ErrorType, TokenType> | undefined;

/**
 * Select from the given nodes by the name.
 */
export type ASTNodeSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<Kinds, ASTData, ErrorType, TokenType>[],
) => ASTNode<Kinds, ASTData, ErrorType, TokenType>[];

/**
 * Select the first matched node from the given nodes by the name.
 */
export type ASTNodeFirstMatchSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<Kinds, ASTData, ErrorType, TokenType>[],
) => ASTNode<Kinds, ASTData, ErrorType, TokenType> | undefined;

export function defaultASTNodeSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
>(
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<Kinds, ASTData, ErrorType, TokenType>[],
) {
  return nodes.filter((n) => n.name === name);
}

export function defaultASTNodeFirstMatchSelector<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
>(
  name: StringOrLiteral<Kinds | ExtractKinds<TokenType>>,
  nodes: readonly ASTNode<Kinds, ASTData, ErrorType, TokenType>[],
) {
  return nodes.find((c) => c.name == name); // TODO: use strict equal
}
