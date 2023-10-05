import type { ILexer } from "../lexer";
import type { Logger } from "../logger";
import type { ParserOutput } from "./output";
import type { ASTNode } from "./ast";

/**
 * The `input` will be fed to the lexer.
 */
export type ParseExec<ASTData, ErrorType, AllKinds extends string> = (
  input?:
    | string
    | {
        input?: string;
        /**
         * Stop parsing when the first error is generated.
         * Be ware, this might cause inconsistent buffer state.
         *
         * Default: `false`.
         */
        stopOnError?: boolean;
      },
) => ParserOutput<ASTData, ErrorType, AllKinds>;

export interface IParser<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
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
  readonly lexer: ILexer<LexerError, LexerKinds>;
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
  readonly parse: ParseExec<ASTData, ErrorType, Kinds | LexerKinds>;
  /**
   * Try to reduce till the parser can't accept more.
   * This is useful if your entry NT can be further reduced.
   *
   * The result may be a ***partial*** accepted result,
   * because the result will be accepted if at least one parse is successful.
   */
  readonly parseAll: ParseExec<ASTData, ErrorType, Kinds | LexerKinds>;
  /**
   * Accumulated error AST nodes.
   */
  readonly errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  hasErrors(): boolean;
  /**
   * Current AST nodes.
   */
  get buffer(): readonly ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
  /**
   * Take the first N AST nodes.
   * This action will commit the parser.
   */
  take(n?: number): ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
}
