import { ASTNode } from "../ast";
import { State } from "./DFA";

export type ELR_RuntimeErrorType = "STATE_CACHE_MISS";

export class ELR_RuntimeError extends Error {
  type: ELR_RuntimeErrorType;
  constructor(type: ELR_RuntimeErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ELR_RuntimeError.prototype);
  }
}

export class StateCacheMissError extends ELR_RuntimeError {
  constructor(
    public state: Readonly<State<any, any, any, any>>,
    public node: Readonly<ASTNode<any, any, any>>
  ) {
    super(
      "STATE_CACHE_MISS",
      `State cache miss for node ${node}, state: ${state} `
    );
    Object.setPrototypeOf(this, StateCacheMissError.prototype);
  }
}
