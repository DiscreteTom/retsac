import type { Stack } from "../../../helper/stack";
import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ILexer,
  Token,
} from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { ReadonlyState } from "../DFA";
import type { Callback, GrammarRuleContext } from "./context";
import type { GrammarStringNoName } from "./grammar";

export type ParsingState<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = {
  stateStack: Stack<
    ReadonlyState<
      NTs,
      ASTData,
      ErrorType,
      LexerDataBindings,
      LexerActionState,
      LexerErrorType,
      Global
    >
  >;
  buffer: ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>,
    Global
  >[];
  /**
   * ASTNode buffer index.
   */
  index: number; // TODO: better description
  /**
   * Newly collected errors in that parsing process.
   */
  errors: ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>,
    Global
  >[];
  trimmedLexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>;
  /**
   * From which candidate to start {@link State.tryLex} on the current state.
   * We only need to store this for current state.
   */
  startCandidateIndex: number;
  /**
   * Grammars that are already lexed in the current parsing state.
   * This is used to avoid duplicate lexing.
   * This will be used and updated in {@link State.tryLex}.
   * We only need to store this for current state.
   */
  lexedGrammars: Set<GrammarStringNoName>;
};

export type ReLexState<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = Readonly<
  ParsingState<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >
> & {
  readonly rollbackStackLength: number;
};

export type RollbackState<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
  Global,
> = {
  readonly rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
  readonly context: GrammarRuleContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType,
    Global
  >;
};
