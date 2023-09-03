import { DefinitionContextBuilder } from "../ctx-builder";
import { Definition } from "./definition";

/**
 * ParserBuilder's main data, to store all definitions and corresponding context builder user defined.
 */
export type ParserBuilderData<T> = {
  defs: Definition;
  ctxBuilder?: DefinitionContextBuilder<T>;
}[];
