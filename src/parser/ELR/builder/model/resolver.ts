import { Condition, Grammar, GrammarRule } from "../../model";
import { ConflictType } from "./conflict";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type RR_ResolverOptions<T> = {
  /** Default: true */
  reduce?: boolean | Condition<T>;
} & (
  | {
      next: (string & {}) | "*";
      handleEnd?: boolean;
    }
  | {
      next?: (string & {}) | "*";
      handleEnd: boolean;
    }
);

export type RS_ResolverOptions<T> = {
  next: (string & {}) | "*";
  /** Default: true */
  reduce?: boolean | Condition<T>;
};

export type ConflictTypeAndResolverOptions<T> =
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<T>;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<T>;
    };

export type ResolvedTempConflict<T> = {
  reducerRule: TempGrammarRule<T>;
  anotherRule: TempGrammarRule<T>;
} & ConflictTypeAndResolverOptions<T>;

export type ResolvedPartialTempConflict<T> = {
  anotherRule: Definition;
} & ConflictTypeAndResolverOptions<T>;

export type ResolvedConflict<T> = {
  reducerRule: GrammarRule<T>;
  anotherRule: GrammarRule<T>;
  next: Grammar[] | "*";
  handleEnd: boolean;
  type: ConflictType;
  reduce: boolean | Condition<T>;
};
