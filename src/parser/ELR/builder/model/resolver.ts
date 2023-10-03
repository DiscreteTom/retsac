import type { AtLeastOneOf, QuotedString } from "../../../../type-helper";
import type { Condition, ConflictType, ResolverHydrationId } from "../../model";
import type { Definition } from "./definition";
import type { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  /**
   *  Default: true
   */
  accept?:
    | boolean
    | Condition<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
};

export type RR_ResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds, LexerError> &
  AtLeastOneOf<
    {
      next: "*" | (Kinds | LexerKinds | QuotedString)[];
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds, LexerError> & {
  next: "*" | (Kinds | LexerKinds | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError
      >;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError
      >;
    }
) &
  BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;

export type ResolvedTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  reducerRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
  anotherRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError
>;

export type ResolvedPartialTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError
>;
