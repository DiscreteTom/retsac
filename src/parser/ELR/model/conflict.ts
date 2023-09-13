import type { Condition } from "./context";
import type { GrammarRule, GrammarSet } from "./grammar";
import type { ParserBuilder } from "../builder";
import type { DefinitionContextBuilder } from "../builder";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface Conflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> {
  type: ConflictType;
  /**
   * If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule.
   */
  anotherRule: Readonly<GrammarRule<ASTData, ErrorType, Kinds, LexerKinds>>;
  /**
   * A list of grammars that will cause conflicts when appear at the next of input.
   */
  next: GrammarSet;
  /**
   * Is this a conflict if there is no next input?
   */
  handleEnd: boolean;
  /**
   * R-S conflict only. How many grammars are overlapped between the two rules.
   */
  overlapped?: number;
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
   * If {@link ResolverHydrationId.type} is {@link ResolverHydrationType.BUILDER}, this is the index of the {@link ParserBuilder.data data} in the builder.
   * If {@link ResolverHydrationId.type} is {@link ResolverHydrationType.CONTEXT}, this is the index of the {@link DefinitionContextBuilder.resolved resolvers} in the definition context.
   */
  index: number;
};

export type ResolvedConflict<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string
> = Pick<
  Conflict<ASTData, ErrorType, Kinds, LexerKinds>,
  "type" | "anotherRule" | "handleEnd"
> & {
  /**
   * Use `'*'` to represent any grammars.
   */
  next:
    | Pick<Conflict<ASTData, ErrorType, Kinds, LexerKinds>, "next">["next"]
    | "*";
  /**
   * If the value is `true` or the condition is met, the conflict will be resolved by accepting the reducer rule.
   */
  accepter: boolean | Condition<ASTData, ErrorType, Kinds, LexerKinds>;
  hydrationId: Readonly<ResolverHydrationId>;
};
