import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<
  State,
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<ASTData, Kinds | LexerKinds>[];
  readonly lexer: ILexer<any, LexerKinds>;
  readonly index: number;
  /**
   * Newly collected errors in that parsing process.
   */
  readonly errors: ASTNode<ASTData, Kinds | LexerKinds>[];
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> = {
  readonly rollback?: Callback<ASTData, Kinds, LexerKinds>;
  readonly context: GrammarRuleContext<ASTData, Kinds, LexerKinds>;
}[];
