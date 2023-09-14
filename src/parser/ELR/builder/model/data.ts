import type { DefinitionContextBuilder } from "../ctx-builder";
import type { Definition } from "./definition";

/**
 * ParserBuilder's main data, to store all definitions and corresponding context builder user defined.
 */
export type ParserBuilderData<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
> = {
  defs: Definition<Kinds>;
  ctxBuilder?: DefinitionContextBuilder<ASTData, ErrorType, Kinds, LexerKinds>;
  // TODO: add hydration id?
};
