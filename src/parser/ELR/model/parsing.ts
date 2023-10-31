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
  LexerError,
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
    LexerError
  >[];
  buffer: readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerError>
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
    Token<LexerDataBindings, LexerError>
  >[];
  lexer: ILexer<LexerDataBindings, LexerActionState, LexerError>;
};

export type ReActionState<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
> = Readonly<
  ParsingState<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
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
  LexerError,
> = {
  readonly rollback?: Callback<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
  readonly context: GrammarRuleContext<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >;
};
