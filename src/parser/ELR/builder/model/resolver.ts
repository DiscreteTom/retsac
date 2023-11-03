import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { AtLeastOneOf, QuotedString } from "../../../../type-helper";
import type { Condition, ConflictType, ResolverHydrationId } from "../../model";
import type { Definition } from "./definition";
import type { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  /**
   * @default: true
   */
  accept?:
    | boolean
    | Condition<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >;
  // TODO: is the following feature needed?
  // /**
  //  * If `true`, the resolver will be applied to the conflict
  //  * in which the reducer rule and another rule is reversed.
  //  * @default: false
  //  */
  // viseVersa?: boolean;
  // /**
  //  * If `true`, the resolver will be applied to the conflict
  //  * in which the reducer rule and another rule is reversed,
  //  * and the `accept` is flipped.
  //  * @default: false
  //  */
  // viceVersaFlip?: boolean;
};

export type RR_ResolverOptions<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = BaseResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
> &
  AtLeastOneOf<
    {
      next: "*" | (Kinds | ExtractKinds<LexerDataBindings> | QuotedString)[];
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = BaseResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
> & {
  next: "*" | (Kinds | ExtractKinds<LexerDataBindings> | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >;
    }
) &
  BaseResolverOptions<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;

export type ResolvedTempConflict<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  reducerRule: TempGrammarRule<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  anotherRule: TempGrammarRule<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
>;

export type ResolvedPartialTempConflict<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
>;
