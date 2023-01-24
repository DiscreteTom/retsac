import { ASTNode } from "../../ast";
import { BaseParserContext, Callback, Rejecter } from "../../base";

export interface LRParserContext<T>
  extends BaseParserContext<T, ASTNode<T>[]> {}

export type LRCallback<T> = Callback<T, ASTNode<T>[], LRParserContext<T>>;
export type LRRejecter<T> = Rejecter<T, ASTNode<T>[], LRParserContext<T>>;
