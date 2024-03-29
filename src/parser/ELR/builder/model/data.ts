import type { GeneralTokenDataBinding } from "../../../../lexer";
import type { DefinitionContextBuilder } from "../ctx-builder";
import type { Definition } from "./definition";

/**
 * ParserBuilder's main data, to store all definitions and corresponding context builder user defined.
 */
export type ParserBuilderData<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = {
  defs: Definition<NTs>;
  ctxBuilder?: DefinitionContextBuilder<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
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
