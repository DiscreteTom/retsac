import type { ILexer } from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<
  State,
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  readonly lexer: ILexer<LexerError, LexerKinds>;
  readonly index: number;
  /**
   * Newly collected errors in that parsing process.
   */
  readonly errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
> = {
  readonly rollback?: Callback<ASTData, ErrorType, Kinds, LexerKinds>;
  readonly context: GrammarRuleContext<ASTData, ErrorType, Kinds, LexerKinds>;
}[];
