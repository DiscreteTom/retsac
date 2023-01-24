import { ILexer } from "../../../lexer";
import { ASTNode } from "../../ast";
import { State } from "../DFA";

export type ReLexStack<T> = {
  stateStack: State<T>[];
  buffer: ASTNode<T>[];
  lexer: ILexer;
  index: number;
  errors: ASTNode<T>[];
  rollbackStackLength: number;
}[];
