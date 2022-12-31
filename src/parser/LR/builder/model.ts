import { Callback, Rejecter } from "../model";
import { TempGrammar, TempGrammarRule } from "./grammar";

export interface Definition {
  [NT: string]: string | string[];
}

export interface DefinitionContext<T> {
  callback: Callback<T>;
  rejecter: Rejecter<T>;
  resolved: PartialResolvedConflict<T>[];
}

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

/** Conflict without reducer. */
export interface PartialConflict<T> {
  type: ConflictType;
  /** If this is a R-S conflict, this rule is a shifter. If this is a R-R conflict, this rule is a reducer. */
  anotherRule: TempGrammarRule<T>;
  /** A list of grammars that will cause conflicts when appear at the next of input. */
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input using `reject`. */
  handleEnd: boolean;
  /** R-S conflict only. How many grammars are overlapped in rule. */
  length?: number;
}

/** ResolvedConflict without reducer. */
export interface PartialResolvedConflict<T> extends PartialConflict<T> {
  reject: boolean;
}

export interface Conflict<T> extends PartialConflict<T> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: TempGrammarRule<T>;
}

export interface ResolvedConflict<T> extends PartialResolvedConflict<T> {
  /** The rule that will try to reduce some grammars to an NT in a conflict. */
  reducerRule: TempGrammarRule<T>;
}
