import { ILexer } from "../lexer";
import { Logger } from "../model";
import { ASTNode } from "./ast";

export type AcceptedParserOutput<ASTData, AllKinds extends string> = {
  accept: true;
  /**
   * Current AST nodes.
   */
  buffer: readonly ASTNode<ASTData, AllKinds>[];
  /**
   * Newly generated AST nodes by the current parsing call with error.
   * Empty list if no error generated by the current parsing call.
   */
  errors: readonly ASTNode<ASTData, AllKinds>[];
};

export const rejectedParserOutput = Object.freeze({ accept: false });
export type RejectedParserOutput = typeof rejectedParserOutput;

export type ParserOutput<ASTData, Kinds extends string> =
  | RejectedParserOutput
  | AcceptedParserOutput<ASTData, Kinds>;

/**
 * The `input` will be fed to the lexer.
 */
export type ParseExec<ASTData, AllKinds extends string> = (
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
      }
) => ParserOutput<ASTData, AllKinds>;

// TODO: default ASTData type
export interface IParser<
  ASTData,
  Kinds extends string,
  LexerKinds extends string
> {
  /**
   * When `debug` is `true`, the parser will use `logger` to log debug info.
   * Default: `false`.
   */
  debug: boolean;
  /**
   * The logger used when `debug` is `true`.
   * Default: `console.log`.
   */
  logger: Logger;
  readonly lexer: ILexer<any, LexerKinds>;
  /**
   * Reset state.
   */
  reset(): this;
  /**
   * Clone a new parser with the same states.
   */
  clone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): IParser<ASTData, Kinds, LexerKinds>;
  /**
   * Clone a new parser without states.
   */
  dryClone(options?: {
    debug?: boolean;
    logger?: Logger;
  }): IParser<ASTData, Kinds, LexerKinds>;
  /**
   * Feed a string to the lexer.
   */
  feed(input: string): this;
  /**
   * Try to yield an entry NT.
   * Stop when the first entry NT is reduced.
   */
  readonly parse: ParseExec<ASTData, Kinds | LexerKinds>;
  /**
   * Try to reduce till the parser can't accept more.
   * This is useful if your entry NT can also be reduced by other rules.
   */
  readonly parseAll: ParseExec<ASTData, Kinds | LexerKinds>;
  /**
   * Accumulated error AST nodes.
   */
  readonly errors: ASTNode<ASTData, Kinds | LexerKinds>[];
  hasErrors(): boolean;
  /**
   * Current AST nodes.
   */
  get buffer(): readonly ASTNode<ASTData, Kinds | LexerKinds>[];
  /**
   * Take the first N AST nodes.
   * This action will commit the parser.
   */
  take(n?: number): ASTNode<ASTData, Kinds | LexerKinds>[];
}
