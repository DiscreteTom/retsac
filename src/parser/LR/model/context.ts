import { ASTNode } from "../../ast";
import { BaseParserContext } from "../../base";

export interface ParserContext<T> extends BaseParserContext<T, ASTNode<T>[]> {}
