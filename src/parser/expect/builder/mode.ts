import { Accepter, TempPartialConflict } from "../../base";
import { ELRParserContext } from "../model";

export interface ELRTempPartialConflict<T>
  extends TempPartialConflict<T, string, ELRParserContext<T>> {}
export type ELRAccepter<T> = Accepter<T, string, ELRParserContext<T>>;
