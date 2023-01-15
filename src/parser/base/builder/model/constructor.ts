import { BaseParserContext } from "../../model";
import { BaseDefinitionContextBuilder } from "../ctx-builder";

export type DefinitionContextBuilderClassCtor<
  T,
  After,
  Ctx extends BaseParserContext<T, After>
> = new () => BaseDefinitionContextBuilder<T, After, Ctx>;
