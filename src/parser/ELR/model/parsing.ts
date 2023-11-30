import type { GeneralTokenDataBinding, ILexer, Token } from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { State } from "../DFA";
import type { Callback, GrammarRuleContext } from "./context";

export type ParsingState<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  /**
   * Current state is `states.at(-1)`.
   */
  stateStack: State<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >[];
  buffer: readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  /**
   * ASTNode buffer index.
   */
  index: number; // TODO: better description
  /**
   * Newly collected errors in that parsing process.
   */
  errors: ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  lexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>;
};

// TODO: rename to reLexState
export type ReActionState<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = Readonly<
  ParsingState<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >
> & {
  readonly rollbackStackLength: number;
};

export type RollbackState<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  readonly rollback?: Callback<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  readonly context: GrammarRuleContext<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
};
