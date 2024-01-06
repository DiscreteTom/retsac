import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { AtLeastOneOf, QuotedString } from "../../../../helper";
import type { Condition, ConflictType, ResolverHydrationId } from "../../model";
import type { Definition } from "./definition";
import type { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  NTs extends string,
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
        NTs,
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = BaseResolverOptions<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
> &
  AtLeastOneOf<
    {
      next: "*" | (NTs | ExtractKinds<LexerDataBindings> | QuotedString)[];
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = BaseResolverOptions<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
> & {
  next: "*" | (NTs | ExtractKinds<LexerDataBindings> | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        NTs,
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
        NTs,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerErrorType
      >;
    }
) &
  BaseResolverOptions<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;

export type ResolvedTempConflict<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  reducerRule: TempGrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  anotherRule: TempGrammarRule<
    NTs,
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
>;

export type ResolvedPartialTempConflict<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  anotherRule: Definition<NTs>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  NTs,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerErrorType
>;
