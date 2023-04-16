import { DefinitionContextBuilder } from "../ctx-builder";
import { Definition } from "./definition";

export type ParserBuilderData<T> = {
  defs: Definition;
  ctxBuilder?: DefinitionContextBuilder<T>;
}[];
