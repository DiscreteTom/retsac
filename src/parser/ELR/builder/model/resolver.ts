import type { ExtractKinds, GeneralTokenDataBinding } from "../../../../lexer";
import type { AtLeastOneOf, QuotedString } from "../../../../type-helper";
import type { Condition, ConflictType, ResolverHydrationId } from "../../model";
import type { Definition } from "./definition";
import type { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
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
        ASTData,
        ErrorType,
        Kinds,
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
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
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerDataBindings,
  LexerActionState,
  LexerError
> & {
  next: "*" | (Kinds | ExtractKinds<LexerDataBindings> | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >;
    }
) &
  BaseResolverOptions<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;

export type ResolvedTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = {
  reducerRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  anotherRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerDataBindings,
  LexerActionState,
  LexerError
>;

export type ResolvedPartialTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerDataBindings,
  LexerActionState,
  LexerError
>;
