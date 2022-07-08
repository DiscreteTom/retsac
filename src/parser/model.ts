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

export interface Parser {
  parse: (buffer: ASTNode[]) => ParserOutput;
}
