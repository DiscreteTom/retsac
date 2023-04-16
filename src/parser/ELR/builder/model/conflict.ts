import { GrammarRule, Grammar } from "../../model";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface Conflict<T> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: Readonly<GrammarRule<T>>;
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule. */
  anotherRule: Readonly<GrammarRule<T>>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: readonly Readonly<Grammar>[] | "*";
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
  /** R-S conflict only. How many grammars are overlapped in rule. */
  length?: number;
}
