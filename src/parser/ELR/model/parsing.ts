import type { ILexer } from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { State } from "../DFA";
import type { Callback, GrammarRuleContext } from "./context";

export type ParsingState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = {
  /**
   * Current state is `states.at(-1)`.
   */
  stateStack: State<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >[];
  buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  /**
   * ASTNode buffer index.
   */
  index: number; // TODO: better description
  /**
   * Newly collected errors in that parsing process.
   */
  errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  lexer: ILexer<LexerError, LexerKinds, LexerActionState>;
};

export type ReActionState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = Readonly<
  ParsingState<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >
> & {
  readonly rollbackStackLength: number;
};

export type RollbackState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
  LexerActionState,
> = {
  readonly rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
  readonly context: GrammarRuleContext<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >;
};
