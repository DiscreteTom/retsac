import type { ILexer } from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { State } from "../DFA";
import type { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  readonly stateStack: State<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >[];
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
  LexerError,
> = {
  readonly rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
  readonly context: GrammarRuleContext<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
}[];
