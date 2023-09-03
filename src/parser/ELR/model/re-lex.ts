import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { Callback, GrammarRuleContext } from "./context";

export type ReLexStack<State, T> = {
  readonly stateStack: State[];
  readonly buffer: ASTNode<T>[];
  readonly lexer: ILexer<any, any>; // TODO: use generic type
  readonly index: number;
  readonly errors: ASTNode<T>[]; // TODO: is this needed?
  readonly rollbackStackLength: number;
}[];

export type RollbackStack<T> = {
  readonly rollback?: Callback<T>;
  readonly context: GrammarRuleContext<T>;
}[];
