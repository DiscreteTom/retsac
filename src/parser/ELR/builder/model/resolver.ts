import { AtLeastOneOf } from "../../../../utils";
import { Condition } from "../../model";
import { ConflictType } from "../../model/conflict";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<T> = {
  /**
   *  Default: true
   */
  accept?: boolean | Condition<T>;
};

export type RR_ResolverOptions<T> = BaseResolverOptions<T> &
  AtLeastOneOf<
    {
      next: (string & {}) | "*";
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<T> = BaseResolverOptions<T> & {
  next: (string & {}) | "*";
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
