import { ASTNode } from "./ast";

export type ParserOutput =
  | { accept: false }
  | {
      accept: true;
      buffer: ASTNode[];
      errors: ASTNode[]; // empty if no error
    };

export type Parser = (buffer: ASTNode[]) => ParserOutput;
