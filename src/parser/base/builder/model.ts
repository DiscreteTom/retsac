import { Callback, Grammar, GrammarRule, Rejecter } from "../model";
import { TempGrammar, TempGrammarRule } from "./temp-grammar";

export interface Definition {
  [NT: string]: string | string[];
}

export interface DefinitionContext<T, After> {
  callback: Callback<T, After>;
  rejecter: Rejecter<T, After>;
  resolved: TempPartialConflict<T, After>[];
}

/**
 * Same param & return value as Rejecter, but flip result.
 * Which means, if return true, accept. If return false, reject.
 */
export type Accepter<T, After> = Rejecter<T, After>;

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

/** Conflict without reducer. */
export interface TempPartialConflict<T, After> {
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  anotherRule: TempGrammarRule<T, After>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
}

export interface TempConflict<T, After> extends TempPartialConflict<T, After> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: TempGrammarRule<T, After>;
}

export interface Conflict<T, After> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: GrammarRule<T, After>;
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  anotherRule: GrammarRule<T, After>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: Grammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
  /** R-S conflict only. How many grammars are overlapped in rule. */
  length?: number;
}
