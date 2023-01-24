import { ASTNode } from "../../ast";
import { BaseParserContext, Callback, Rejecter } from "../../base";

export interface LRParserContext<T>
  extends BaseParserContext<T, readonly ASTNode<T>[]> {}

export type LRCallback<T> = Callback<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>
>;
export type LRRejecter<T> = Rejecter<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>
>;
