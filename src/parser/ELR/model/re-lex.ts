import type { ParsingState } from "./parsing";

export type ReLexStack<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  LexerError,
> = (Readonly<
  ParsingState<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
> & {
  readonly rollbackStackLength: number;
})[];

// export type ReParseStack<
//   ASTData,
//   ErrorType,
//   Kinds extends string,
//   LexerKinds extends string,
//   LexerError,
// > = {
//   possibility: AcceptedParserOutput<ASTData, ErrorType, Kinds | LexerKinds> & {
//     context: GrammarRuleContext<
//       ASTData,
//       ErrorType,
//       Kinds,
//       LexerKinds,
//       LexerError
//     >;
//     commit: boolean;
//     rollback?:
//       | Callback<ASTData, ErrorType, Kinds, LexerKinds, LexerError>
//       | undefined;
//   };
//   lexer: ILexer<LexerError, LexerKinds>;
//   buffer: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
//   errors: ASTNode<ASTData, ErrorType, Kinds | LexerKinds>[];
//   reLexStack: ReLexStack<ASTData, ErrorType, Kinds, LexerKinds, LexerError>;
//   rollbackStack: RollbackState<
//     ASTData,
//     ErrorType,
//     Kinds,
//     LexerKinds,
//     LexerError
//   >[]; // TODO: should we store rollback stack here? will this cause redundant rollback?
// }[];
