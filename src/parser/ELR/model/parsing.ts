import type { ILexer } from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { AcceptedParserOutput } from "../../output";
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
  buffer: readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  /**
   * ASTNode buffer index.
   */
  index: number; // TODO: better description
  /**
   * Newly collected errors in that parsing process.
   */
  errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  lexer: ILexer<LexerError, LexerKinds>;
};

export type ReLexState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = Readonly<
  ParsingState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
> & {
  readonly rollbackStackLength: number;
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

export type ReParseState<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = {
  possibility: AcceptedParserOutput<ASTData, ErrorType, Kinds | LexerKinds> & {
    context: GrammarRuleContext<
      ASTData,
      ErrorType,
      Kinds,
      LexerKinds,
      LexerError
    >;
    commit: boolean;
    rollback?:
      | Callback<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
      | undefined;
  };
  parsingState: ParsingState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
  reLexStack: ReLexState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>[];
  readonly rollbackStackLength: number;
};
