import type { GeneralTokenDataBinding, Token } from "../../lexer";
import type { ASTNode } from "../ast";
import type { State } from "./DFA";

export type ELR_RuntimeErrorType = "STATE_CACHE_MISS";

export class ELR_RuntimeError extends Error {
  type: ELR_RuntimeErrorType;
  constructor(type: ELR_RuntimeErrorType, msg: string) {
    super(msg);
    this.type = type;
    Object.setPrototypeOf(this, ELR_RuntimeError.prototype);
  }
}

export class StateCacheMissError<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> extends ELR_RuntimeError {
  constructor(
    public state: Readonly<
      State<
        Kinds,
        ASTData,
        ErrorType,
        LexerDataBindings,
        LexerActionState,
        LexerError
      >
    >,
    public node: Readonly<
      ASTNode<Kinds, ASTData, ErrorType, Token<LexerDataBindings, LexerError>>
    >,
  ) {
    super(
      "STATE_CACHE_MISS",
      `State cache miss for node ${node}, state: \n${state}\n` +
        `This might be caused by an outdated parser data cache (rebuild the parser data to fix this) or you might forget to call \`parser.take\` to consume the ASTNode from the buffer.`,
    );
    Object.setPrototypeOf(this, StateCacheMissError.prototype);
  }
}
