import { AtLeastOneOf } from "../../../../utils";
import { Condition } from "../../model";
import { ConflictType } from "../../model/conflict";
import { Definition } from "./definition";
import { TempGrammarRule } from "./temp-grammar";

export type BaseResolverOptions<ASTData, Kinds extends string> = {
  /**
   *  Default: true
   */
  accept?: boolean | Condition<ASTData, Kinds>;
};

export type RR_ResolverOptions<
  ASTData,
  Kinds extends string
> = BaseResolverOptions<ASTData, Kinds> &
  AtLeastOneOf<
    {
      next: (string & {}) | "*";
      handleEnd: boolean;
    },
    "next" | "handleEnd"
  >;

export type RS_ResolverOptions<
  ASTData,
  Kinds extends string
> = BaseResolverOptions<ASTData, Kinds> & {
  next: (string & {}) | "*";
};

export type ConflictTypeAndResolverOptions<ASTData, Kinds extends string> = (
  | {
      type: ConflictType.REDUCE_REDUCE;
      options: RR_ResolverOptions<ASTData, Kinds>;
    }
  | {
      type: ConflictType.REDUCE_SHIFT;
      options: RS_ResolverOptions<ASTData, Kinds>;
    }
) &
  BaseResolverOptions<ASTData, Kinds>;

export type ResolvedTempConflict<ASTData, Kinds extends string> = {
  reducerRule: TempGrammarRule<ASTData, Kinds>;
  anotherRule: TempGrammarRule<ASTData, Kinds>;
  hydrationId: {
    type: "builder" | "context"; // TODO: use enum
    index: number;
  };
} & ConflictTypeAndResolverOptions<ASTData, Kinds>;

export type ResolvedPartialTempConflict<ASTData, Kinds extends string> = {
  anotherRule: Definition<Kinds>;
  hydrationId: {
    type: "builder" | "context"; // TODO: extract type
    index: number;
  };
} & ConflictTypeAndResolverOptions<ASTData, Kinds>;
