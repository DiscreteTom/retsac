import type { ExtractKinds, GeneralToken } from "../lexer";
import type { StringOrLiteral } from "../helper";
import type { ASTNode, NTNode, TNode } from "./ast";

export type ExtractASTNodeType<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>,
  Global,
> =
  // check T first, because when define the parser, the lexer's token types are already known
  TargetKind extends ExtractKinds<TokenType>
    ? // target is T
      TNode<TargetKind, NTs, ASTData, ErrorType, TokenType, Global>
    : TargetKind extends NTs
    ? // target is NT
      NTNode<TargetKind, NTs, ASTData, ErrorType, TokenType, Global>
    : // target is a literal or user defined name, use general ASTNode
      // TODO: can we determine the type by the user defined name?
      ASTNode<
        NTs | ExtractKinds<TokenType>,
        NTs,
        ASTData,
        ErrorType,
        TokenType,
        Global
      >;

/**
 * Select children nodes by the name.
 */
export type NTNodeChildrenSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind, // TODO: support user defined name
) => ExtractASTNodeType<
  NTs,
  ASTData,
  ErrorType,
  TokenType,
  TargetKind,
  Global
>[];

/**
 * Select the first matched child node by the name.
 */
export type NTNodeFirstMatchChildSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
) =>
  | ExtractASTNodeType<NTs, ASTData, ErrorType, TokenType, TargetKind, Global>
  | undefined;

/**
 * Select from the given nodes by the name.
 */
export type ASTNodeSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
  nodes: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >[],
) => ExtractASTNodeType<
  NTs,
  ASTData,
  ErrorType,
  TokenType,
  TargetKind,
  Global
>[];

/**
 * Select the first matched node from the given nodes by the name.
 */
export type ASTNodeFirstMatchSelector<
  NTs extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
  Global,
> = <TargetKind extends StringOrLiteral<NTs | ExtractKinds<TokenType>>>(
  name: TargetKind,
  nodes: readonly ASTNode<
    NTs | ExtractKinds<TokenType>,
    NTs,
    ASTData,
    ErrorType,
    TokenType,
    Global
  >[],
) =>
  | ExtractASTNodeType<NTs, ASTData, ErrorType, TokenType, TargetKind, Global>
  | undefined;
