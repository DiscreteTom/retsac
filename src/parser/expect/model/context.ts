import { ILexer } from "../../../lexer";
import { BaseParserContext } from "../../base";

export interface ParserContext<T> extends BaseParserContext<T, string> {
  readonly lexer: ILexer;
}
