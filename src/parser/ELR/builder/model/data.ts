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
  LexerError,
> = {
  defs: Definition<Kinds>;
  ctxBuilder?: DefinitionContextBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
  /**
   * If `true`, only resolve conflicts, don't create definition.
   */
  resolveOnly: boolean;
  /**
   * The index of data where the restored grammar rule can find its context.
   */
  hydrationId: number;
};
