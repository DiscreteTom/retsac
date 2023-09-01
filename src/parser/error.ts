import { ASTNode } from "./ast";

export type ParserErrorType = "INVALID_TRAVERSE";

export class ParserError extends Error {
  type: ParserErrorType;
  constructor(type: ParserErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ParserError.prototype);
  }
}

export class InvalidTraverseError<T> extends ParserError {
  constructor(public node: ASTNode<T>) {
    super(
      "INVALID_TRAVERSE",
      `Traversing a T is invalid. Consider defining a traverser for it's parent. Current: \`${node.toString()}\`, parent: \`${node.parent!.toString()}\`.`
    );
    Object.setPrototypeOf(this, InvalidTraverseError.prototype);
  }
}
