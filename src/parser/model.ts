import { ASTNode } from "./ast";

export type ParserOutput =
  | { accept: false }
  | {
      accept: true;
      /** Result AST nodes. */
      buffer: ASTNode[];
      /** Empty if no error. */
      errors: ASTNode[];
    };

export type ParseExec = (buffer: ASTNode[]) => ParserOutput;

export interface Parser {
  parse: ParseExec;
}
