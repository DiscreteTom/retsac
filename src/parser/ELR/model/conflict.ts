import { Condition } from "./context";
import { GrammarRule, Grammar } from "./grammar";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface Conflict<ASTData, Kinds extends string> {
  type: ConflictType;
  /**
   * If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule.
   */
  anotherRule: Readonly<GrammarRule<ASTData, Kinds>>;
  /**
   * A list of grammars that will cause conflicts when appear at the next of input.
   */
  next: readonly Readonly<Grammar>[]; // TODO: use GrammarSet
  /**
   * Is this a conflict if there is no next input?
   */
  handleEnd: boolean;
  /**
   * R-S conflict only. How many grammars are overlapped between the two rules.
   */
  overlapped?: number;
}

export type ResolvedConflict<ASTData, Kinds extends string> = Pick<
  Conflict<ASTData, Kinds>,
  "type" | "anotherRule" | "handleEnd"
> & {
  /**
   * Use `'*'` to represent any grammars.
   */
  next: Pick<Conflict<ASTData, Kinds>, "next">["next"] | "*";
  /**
   * If the value is `true` or the condition is met, the conflict will be resolved by accepting the reducer rule.
   */
  accepter: boolean | Condition<ASTData, Kinds>;
};
