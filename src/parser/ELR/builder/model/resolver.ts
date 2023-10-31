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
  LexerError,
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
        LexerError
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
  LexerError,
> = BaseResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerError
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
  LexerError,
> = BaseResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerError
> & {
  next: "*" | (Kinds | ExtractKinds<LexerDataBindings> | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
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
        LexerError
      >;
    }
) &
  BaseResolverOptions<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;

export type ResolvedTempConflict<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = {
  reducerRule: TempGrammarRule<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  anotherRule: TempGrammarRule<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerError
>;

export type ResolvedPartialTempConflict<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  Kinds,
  ASTData,
  ErrorType,
  LexerDataBindings,
  LexerActionState,
  LexerError
>;
