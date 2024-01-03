import type { ExtractKinds, GeneralToken } from "../lexer";
import type { StringOrLiteral } from "../helper";
import type { ASTNode } from "./ast";

/**
 * Select children nodes by the name.
 */
export type ASTNodeChildrenSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind, // TODO: support user defined name
) => ASTNode<
  // TODO: extract kind
  TargetKind extends NTs
    ? TargetKind // target is NT
    : TargetKind extends ExtractKinds<TokenType>
    ? TargetKind // target is T
    : ExtractKinds<TokenType>, // target is a literal, use all T
  NTs,
  ASTData,
  ErrorType,
  TokenType
>[];

/**
 * Select the first matched child node by the name.
 */
export type ASTNodeFirstMatchChildSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
) =>
  | ASTNode<
      TargetKind extends NTs
        ? TargetKind // target is NT
        : TargetKind extends ExtractKinds<TokenType>
        ? TargetKind // target is T
        : ExtractKinds<TokenType>, // target is a literal, use all T
      NTs,
      ASTData,
      ErrorType,
      TokenType
    >
  | undefined;

/**
 * Select from the given nodes by the name.
 */
export type ASTNodeSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
  nodes: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType
  >[],
) => ASTNode<
  TargetKind extends NTs
    ? TargetKind // target is NT
    : TargetKind extends ExtractKinds<TokenType>
    ? TargetKind // target is T
    : ExtractKinds<TokenType>, // target is a literal, use all T
  NTs,
  ASTData,
  ErrorType,
  TokenType
>[];

/**
 * Select the first matched node from the given nodes by the name.
 */
export type ASTNodeFirstMatchSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
  nodes: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType
  >[],
) =>
  | ASTNode<
      TargetKind extends NTs
        ? TargetKind // target is NT
        : TargetKind extends ExtractKinds<TokenType>
        ? TargetKind // target is T
        : ExtractKinds<TokenType>, // target is a literal, use all T
      NTs,
      ASTData,
      ErrorType,
      TokenType
    >
  | undefined;
