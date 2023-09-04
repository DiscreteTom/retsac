import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<State, ASTData, Kinds extends string> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<ASTData, Kinds>[];
  readonly lexer: ILexer<any, any>; // TODO: use generic type
  readonly index: number;
  readonly errors: ASTNode<ASTData, Kinds>[]; // TODO: is this needed?
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<ASTData, Kinds extends string> = {
  readonly rollback?: Callback<ASTData, Kinds>;
  readonly context: GrammarRuleContext<ASTData, Kinds>;
}[];
