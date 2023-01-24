import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { State } from "../DFA";
import { ELRCallback, ELRParserContext } from "./context";

export type ReLexStack<T> = {
  stateStack: State<T>[];
  buffer: ASTNode<T>[];
  lexer: ILexer;
  index: number;
  errors: ASTNode<T>[];
  rollbackStackLength: number;
}[];

export type RollbackStack<T> = {
  rollback: ELRCallback<T>;
  context: ELRParserContext<T>;
}[];
