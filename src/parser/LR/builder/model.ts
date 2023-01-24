import { ASTNode } from "../../ast";
import { Accepter, TempPartialConflict } from "../../base";
import { LRParserContext } from "../model";

export interface LRTempPartialConflict<T>
  extends TempPartialConflict<T, readonly ASTNode<T>[], LRParserContext<T>> {}

export type LRAccepter<T> = Accepter<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>
>;
