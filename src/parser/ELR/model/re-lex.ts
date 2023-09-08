import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<State, ASTData, Kinds extends string> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<ASTData, Kinds>[];
  readonly lexer: ILexer<any, any>; // TODO: use generic type
  readonly index: number;
  /**
   * Newly collected errors in that parsing process.
   */
  readonly errors: ASTNode<ASTData, Kinds>[];
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<ASTData, Kinds extends string> = {
  readonly rollback?: Callback<ASTData, Kinds>;
  readonly context: GrammarRuleContext<ASTData, Kinds>;
}[];
