import type {
  ExtractKinds,
  GeneralTokenDataBinding,
  ITrimmedLexer,
  Token,
} from "../../../lexer";
import type { ASTNode } from "../../ast";
import type { State } from "../DFA";
import type { Callback, GrammarRuleContext } from "./context";

export type ParsingState<
  NTs extends string,
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
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >[];
  buffer: readonly ASTNode<
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
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
    NTs | ExtractKinds<LexerDataBindings>,
    NTs,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  lexer: ITrimmedLexer<LexerDataBindings, LexerActionState, LexerErrorType>;
};

// TODO: rename to reLexState
export type ReActionState<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = Readonly<
  ParsingState<
    NTs,
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
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> = {
  readonly rollback?: Callback<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
  readonly context: GrammarRuleContext<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerErrorType
  >;
};
