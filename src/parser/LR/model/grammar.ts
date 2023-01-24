import { ASTNode } from "../../ast";
import { GrammarRule } from "../../base";
import { LRParserContext } from "./context";

export type LRGrammarRule<T> = GrammarRule<T, ASTNode<T>[], LRParserContext<T>>;
