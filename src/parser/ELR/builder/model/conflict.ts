import { GrammarRule, Grammar } from "../../model";
import { TempGrammarRule, TempGrammar } from "./temp-grammar";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

/** TempConflict without the reducer rule. */
export interface TempPartialConflict<T> {
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule. */
  anotherRule: TempGrammarRule<T>;
  /** A list of temp grammars that will cause conflicts when appear at the next of input. */
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
}

export interface TempConflict<T> extends TempPartialConflict<T> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: TempGrammarRule<T>;
}

export interface Conflict<T> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: GrammarRule<T>;
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter rule. If this is a R-R conflict, this rule is a reducer rule. */
  anotherRule: GrammarRule<T>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: Grammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
  /** R-S conflict only. How many grammars are overlapped in rule. */
  length?: number;
}
