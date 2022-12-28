import { TempGrammarRule } from "./grammar";

export interface Definition {
  [NT: string]: string | string[];
}

export enum ConflictType {
  REDUCE_SHIFT,
  REDUCE_REDUCE,
}

export interface ResolvedConflict {
  type: ConflictType;
  rule1: TempGrammarRule<void>;
  rule2: TempGrammarRule<void>;
}
