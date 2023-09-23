import { writeFileSync } from "fs";
import type { IParserBuilder } from "../../../src/parser/ELR";
import type { ILexer } from "../../../src/lexer";

export function generateParserDataFile<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  AppendLexerKinds extends string,
  LexerError,
  AppendLexerError,
>(
  builder: IParserBuilder<ASTData, ErrorType, Kinds, LexerKinds, LexerError>,
  lexer: ILexer<AppendLexerError, AppendLexerKinds>,
  path: string,
) {
  const { serializable } = builder.build({ lexer, serialize: true });
  const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

  writeFileSync(path, dfaStr);
}
