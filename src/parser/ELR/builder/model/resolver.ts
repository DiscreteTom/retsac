import { AtLeastOneOf } from "../../../../type-helper";
import { Condition, ConflictType, ResolverHydrationId } from "../../model";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = {
  /**
   *  Default: true
   */
  accept?: boolean | Condition<ASTData, ErrorType, Kinds, LexerKinds>;
};

export type RR_ResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds> &
  AtLeastOneOf<
    {
      next: (string & {}) | "*";
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds> & {
  next: (string & {}) | "*";
};

export type ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
    }
) &
  BaseResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;

export type ResolvedTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = {
  reducerRule: TempGrammarRule<ASTData, ErrorType, Kinds, LexerKinds>;
  anotherRule: TempGrammarRule<ASTData, ErrorType, Kinds, LexerKinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;

export type ResolvedPartialTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<ASTData, ErrorType, Kinds, LexerKinds>;
