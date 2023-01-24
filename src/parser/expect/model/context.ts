import { ILexer } from "../../../lexer";
import { BaseParserContext, Callback, Rejecter } from "../../base";

export interface ELRParserContext<T> extends BaseParserContext<T, string> {
  readonly lexer: ILexer;
}
export type ELRCallback<T> = Callback<T, string, ELRParserContext<T>>;
export type ELRRejecter<T> = Rejecter<T, string, ELRParserContext<T>>;
