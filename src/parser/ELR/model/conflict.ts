import type { Condition } from "./context";
import type { GrammarRule, GrammarSet } from "./grammar";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ParserBuilder } from "../builder";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { DefinitionContextBuilder } from "../builder";
import type { ExtractKinds, GeneralTokenDataBinding } from "../../../lexer";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface Conflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> {
  type: ConflictType;
  /**
   * If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule.
   */
  anotherRule: Readonly<
    GrammarRule<
      ASTData,
      ErrorType,
      Kinds,
      LexerDataBindings,
      LexerActionState,
      LexerError
    >
  >;
  /**
   * A list of grammars that will cause conflicts when appear at the next of input.
   */
  next: GrammarSet<Kinds, ExtractKinds<LexerDataBindings>>;
  /**
   * Is this a conflict if there is no next input?
   */
  handleEnd: boolean;
}

export enum ResolverHydrationType {
  /**
   * The resolver is defined in builder level.
   */
  BUILDER,
  /**
   * The resolver is defined in definition context.
   */
  CONTEXT,
}

export type ResolverHydrationId = {
  type: ResolverHydrationType;
  /**
   * If {@link ResolverHydrationId.type type} is {@link ResolverHydrationType.BUILDER BUILDER},
   * this is the index of the {@link ParserBuilder.data data} in the builder,
   * and the resolver should be the first element of the resolvers array.
   *
   * If {@link ResolverHydrationId.type type} is {@link ResolverHydrationType.CONTEXT CONTEXT},
   * this is the index of the {@link DefinitionContextBuilder.resolved resolvers} in the grammar rule's definition context.
   */
  index: number;
};

export type ResolvedConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = Pick<
  Conflict<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
  "type" | "anotherRule" | "handleEnd"
> & {
  /**
   * Use `'*'` to represent any grammars.
   */
  next:
    | Conflict<
        ASTData,
        ErrorType,
        Kinds,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >["next"]
    | "*";
} & (
    | {
        /**
         * If the value is `true` or the condition is met, the conflict will be resolved by accepting the reducer rule.
         */
        accepter: boolean;
        hydrationId: undefined; // we don't need to hydrate if the accepter is a boolean
      }
    | {
        accepter: Condition<
          ASTData,
          ErrorType,
          Kinds,
          LexerDataBindings,
          LexerActionState,
          LexerError
        >;
        /**
         * If the accepter is not a boolean, we need this hydration ID to restore the accepter.
         */
        hydrationId: Readonly<ResolverHydrationId>;
      }
  );
