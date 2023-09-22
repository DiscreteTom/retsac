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
> = {
  /**
   * Current state is `states.at(-1)`.
   */
  stateStack: State<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[];
  /**
   * ASTNode buffer index.
   */
  index: number; // TODO: better description
  /**
   * Newly collected errors in that parsing process.
   */
  errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  lexer: ILexer<LexerError, LexerKinds>;
};

export type RollbackState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  readonly rollback?: Callback<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
  readonly context: GrammarRuleContext<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError
  >;
};
