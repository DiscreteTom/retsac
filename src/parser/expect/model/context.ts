import { ILexer } from "../../../lexer/model";
import { BaseParserContext } from "../../base";

export interface ParserContext<T> extends BaseParserContext<T, string> {
  readonly lexer: ILexer;
}
