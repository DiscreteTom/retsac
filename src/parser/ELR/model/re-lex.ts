import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<State, T, Kinds extends string> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<T, Kinds>[];
  readonly lexer: ILexer<any, any>; // TODO: use generic type
  readonly index: number;
  readonly errors: ASTNode<T, Kinds>[]; // TODO: is this needed?
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<T, Kinds extends string> = {
  readonly rollback?: Callback<T, Kinds>;
  readonly context: GrammarRuleContext<T, Kinds>;
}[];
