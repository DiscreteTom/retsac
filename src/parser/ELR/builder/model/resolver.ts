import { AtLeastOneOf } from "../../../../utils";
import { Condition } from "../../model";
import { ConflictType } from "../../model/conflict";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<T, Kinds extends string> = {
  /**
   *  Default: true
   */
  accept?: boolean | Condition<T, Kinds>;
};

export type RR_ResolverOptions<T, Kinds extends string> = BaseResolverOptions<
  T,
  Kinds
> &
  AtLeastOneOf<
    {
      next: (string & {}) | "*";
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<T, Kinds extends string> = BaseResolverOptions<
  T,
  Kinds
> & {
  next: (string & {}) | "*";
};

export type ConflictTypeAndResolverOptions<T, Kinds extends string> =
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<T, Kinds>;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<T, Kinds>;
    };

export type ResolvedTempConflict<T, Kinds extends string> = {
  reducerRule: TempGrammarRule<T, Kinds>;
  anotherRule: TempGrammarRule<T, Kinds>;
} & ConflictTypeAndResolverOptions<T, Kinds>;

export type ResolvedPartialTempConflict<T, Kinds extends string> = {
  anotherRule: Definition<Kinds>;
} & ConflictTypeAndResolverOptions<T, Kinds>;
