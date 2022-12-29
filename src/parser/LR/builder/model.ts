import { Callback, Rejecter } from "../model";
import { TempGrammar, TempGrammarRule, TempGrammarType } from "./grammar";
import { defToTempGRs } from "./utils";

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
  another: TempGrammarRule<T>;
  next: TempGrammar[];
  /** Whether to handle conflict if reach the end of input */
  end: boolean;
}

/** ResolvedConflict without reducer. */
export interface PartialResolvedConflict<T> extends PartialConflict<T> {
  reject: boolean;
}

export interface Conflict<T> extends PartialConflict<T> {
  reducer: TempGrammarRule<T>;
}

export interface ResolvedConflict<T> extends PartialResolvedConflict<T> {
  reducer: TempGrammarRule<T>;
}
