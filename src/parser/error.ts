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
  Kinds extends string
> extends ParserError {
  constructor(public node: ASTNode<ASTData, ErrorType, Kinds>) {
    super(
      "INVALID_TRAVERSE",
      `Traversing a T is invalid. Consider defining a traverser for it's parent. Current: \`${node}\`, parent: \`${node.parent}\`.`
    );
    Object.setPrototypeOf(this, InvalidTraverseError.prototype);
  }
}
