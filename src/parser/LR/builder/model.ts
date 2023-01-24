import { ASTNode } from "../../ast";
import { Accepter, TempPartialConflict } from "../../base";
import { LRParserContext } from "../model";

export interface LRTempPartialConflict<T>
  extends TempPartialConflict<T, ASTNode<T>[], LRParserContext<T>> {}

export type LRAccepter<T> = Accepter<T, ASTNode<T>[], LRParserContext<T>>;
