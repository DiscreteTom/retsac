import { AtLeastOneOf } from "../../../../utils";
import { Condition, ConflictType, ResolverHydrationId } from "../../model";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = {
  /**
   *  Default: true
   */
  accept?: boolean | Condition<ASTData, Kinds, LexerKinds>;
};

export type RR_ResolverOptions<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = BaseResolverOptions<ASTData, Kinds, LexerKinds> &
  AtLeastOneOf<
    {
      next: (string & {}) | "*";
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = BaseResolverOptions<ASTData, Kinds, LexerKinds> & {
  next: (string & {}) | "*";
};

export type ConflictTypeAndResolverOptions<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<ASTData, Kinds, LexerKinds>;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<ASTData, Kinds, LexerKinds>;
    }
) &
  BaseResolverOptions<ASTData, Kinds, LexerKinds>;

export type ResolvedTempConflict<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = {
  reducerRule: TempGrammarRule<ASTData, Kinds, LexerKinds>;
  anotherRule: TempGrammarRule<ASTData, Kinds, LexerKinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<ASTData, Kinds, LexerKinds>;

export type ResolvedPartialTempConflict<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<ASTData, Kinds, LexerKinds>;
