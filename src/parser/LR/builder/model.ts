import { GrammarCallback, Rejecter } from "../model";

/** Grammar type, but can't distinguish N or NT. */
export enum TempGrammarType {
  LITERAL,
  /** T or NT */
  GRAMMAR,
}

/** Grammar, but can't distinguish N or NT. */
export interface TempGrammar {
  type: TempGrammarType;
  /** Literal content, or T/NT's type name. */
  content: string;
}

export interface TempGrammarRule<T> {
  rule: TempGrammar[];
  /** The reduce target. */
  NT: string;
  callback?: GrammarCallback<T>;
  rejecter?: Rejecter<T>;
}

export interface Definition {
  [NT: string]: string | string[];
}

export enum ConflictType {
  SHIFT_REDUCE,
  REDUCE_REDUCE,
}

export interface ResolvedConflict {
  type: ConflictType;
  rule1: TempGrammarRule<void>;
  rule2: TempGrammarRule<void>;
}
