import type {
  GeneralToken,
  GeneralTokenDataBinding,
  ILexer,
  Token,
} from "../lexer";
import type { Logger } from "../logger";
import type { ParserOutput } from "./output";
import type { ASTNode } from "./ast";

/**
 * If `input` is provided, it will be fed to the lexer.
 */
export type ParseExec<
  Kinds extends string,
  ASTData,
  ErrorType,
  TokenType extends GeneralToken,
> = (
  input?:
    | string
    | {
        input?: string;
        /**
         * Stop parsing when the first error is generated.
         * Be ware, this might cause inconsistent buffer state.
         *
         * @default false
         */
        stopOnError?: boolean;
      },
) => ParserOutput<Kinds, ASTData, ErrorType, TokenType>;

export interface IParser<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerErrorType,
> {
  /**
   * When `debug` is `true`, the parser will use `logger` to log debug info.
   * @default false
   */
  debug: boolean;
  /**
   * The logger used when `debug` is `true`.
   * @default defaultLogger
   */
  logger: Logger;
  /**
   * If `true`, when `parser.parse` is successful, the parser will commit automatically.
   * This is useful to optimize the performance.
   *
   * @default false
   */
  autoCommit: boolean;
  /**
   * If `true`, when an entry NT is reduced, the parser will accept it immediately
   * without checking the entry NT's follow set.
   *
   * @default false
   */
  ignoreEntryFollow: boolean; // TODO: rename this to a more intuitive name
  readonly lexer: ILexer<LexerDataBindings, LexerActionState, LexerErrorType>;
  /**
   * Reset state.
   */
  reset(): this;
  /**
   * Feed a string to the lexer.
   */
  feed(input: string): this;
  /**
   * Try to yield an entry NT.
   * Stop when the first entry NT is reduced and follow match(or reach EOF).
   */
  readonly parse: ParseExec<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;
  /**
   * Try to reduce till the parser can't accept more.
   * This is useful if your entry NT can be further reduced.
   *
   * The result may be a ***partial*** accepted result,
   * because the result will be accepted if at least one parse is successful.
   */
  readonly parseAll: ParseExec<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >;
  /**
   * Accumulated error AST nodes.
   */
  readonly errors: ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  hasErrors(): boolean;
  /**
   * Current AST nodes.
   */
  get buffer(): readonly ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
  /**
   * Take the first N AST nodes.
   * This action will commit the parser.
   */
  take(
    n?: number,
  ): ASTNode<
    Kinds,
    ASTData,
    ErrorType,
    Token<LexerDataBindings, LexerErrorType>
  >[];
}
