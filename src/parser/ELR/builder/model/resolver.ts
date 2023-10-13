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
  LexerActionState,
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
        LexerKinds,
        LexerError,
        LexerActionState
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
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError,
  LexerActionState
> &
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
  LexerActionState,
> = BaseResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError,
  LexerActionState
> & {
  next: "*" | (Kinds | LexerKinds | QuotedString)[];
};

export type ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<
        ASTData,
        ErrorType,
        Kinds,
        LexerKinds,
        LexerError,
        LexerActionState
      >;
    }
) &
  BaseResolverOptions<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;

export type ResolvedTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = {
  reducerRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  anotherRule: TempGrammarRule<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError,
  LexerActionState
>;

export type ResolvedPartialTempConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = {
  anotherRule: Definition<Kinds>;
  hydrationId: Readonly<ResolverHydrationId>;
} & ConflictTypeAndResolverOptions<
  ASTData,
  ErrorType,
  Kinds,
  LexerKinds,
  LexerError,
  LexerActionState
>;
