import { ASTNode } from "../../ast";
import { GrammarRule } from "../../base";
import { LRParserContext } from "./context";

export type LRGrammarRule<T> = GrammarRule<
  T,
  readonly ASTNode<T>[],
  LRParserContext<T>
>;
