import { Condition } from "./context";
import { GrammarRule, Grammar } from "./grammar";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface Conflict<T> {
  type: ConflictType;
  /**
   * If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule.
   */
  anotherRule: Readonly<GrammarRule<T>>;
  /**
   * A list of grammars that will cause conflicts when appear at the next of input.
   */
  next: readonly Readonly<Grammar>[];
  /**
   * Is this a conflict if there is no next input?
   */
  handleEnd: boolean;
  /**
   * R-S conflict only. How many grammars are overlapped between the two rules.
   */
  overlapped?: number;
  resolver: {
    next: readonly Readonly<Grammar>[] | "*";
    handleEnd: boolean;
    reduce: boolean | Condition<T>;
  };
}
