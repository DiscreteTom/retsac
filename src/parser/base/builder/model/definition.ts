import { BaseParserContext, Callback, Rejecter } from "../../model";
import { TempPartialConflict } from "./conflict";
import { Accepter } from "./context";

export interface Definition {
  [NT: string]: string | string[];
}

export interface DefinitionContext<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> {
  callback: Callback<T, After, Ctx>;
  rejecter: Rejecter<T, After, Ctx>;
  resolved: TempPartialConflict<T, After, Ctx>[];
  rollback: Callback<T, After, Ctx>;
  commit: Accepter<T, After, Ctx>;
}
