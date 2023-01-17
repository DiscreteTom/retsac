import { BaseParserContext, GrammarRule, Grammar } from "../../model";
import { TempGrammarRule, TempGrammar } from "../temp-grammar";

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

/** Conflict without reducer. */
export interface TempPartialConflict<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> {
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  anotherRule: TempGrammarRule<T, After, Ctx>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
}

export interface TempConflict<T, After, Ctx extends BaseParserContext<T, After>>
  extends TempPartialConflict<T, After, Ctx> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: TempGrammarRule<T, After, Ctx>;
}

export interface Conflict<T, After, Ctx extends BaseParserContext<T, After>> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: GrammarRule<T, After, Ctx>;
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  anotherRule: GrammarRule<T, After, Ctx>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: Grammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
  /** R-S conflict only. How many grammars are overlapped in rule. */
  length?: number;
}