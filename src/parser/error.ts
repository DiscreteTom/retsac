import type { GeneralToken } from "../lexer";
import type { ASTNode } from "./ast";

export type ParserErrorType = "INVALID_TRAVERSE";

export class ParserError extends Error {
  type: ParserErrorType;
  constructor(type: ParserErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ParserError.prototype);
  }
}

export class InvalidTraverseError<
  ASTData,
  ErrorType,
  Kinds extends string,
  TokenType extends GeneralToken,
> extends ParserError {
  constructor(public node: ASTNode<Kinds, ASTData, ErrorType, TokenType>) {
    super(
      "INVALID_TRAVERSE",
      `Traversing a T is invalid. Consider defining a traverser for it's parent. Current: \`${node}\`, parent: \`${node.parent}\`.`,
    );
    Object.setPrototypeOf(this, InvalidTraverseError.prototype);
  }
}
