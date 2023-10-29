import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { DefinitionContextBuilder } from "../ctx-builder";
import type { Definition } from "./definition";

/**
 * ParserBuilder's main data, to store all definitions and corresponding context builder user defined.
 */
export type ParserBuilderData<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerError,
  LexerActionState,
> = {
  defs: Definition<Kinds>;
  ctxBuilder?: DefinitionContextBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerDataBindings,
    LexerError,
    LexerActionState
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
