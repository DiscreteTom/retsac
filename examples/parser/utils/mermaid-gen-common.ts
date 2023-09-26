import { writeFileSync } from "fs";
import type { IParserBuilder } from "../../../src/parser/ELR";
import type { ILexer } from "../../../src/lexer";

export function generateMermaidFile<
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
  entry: Kinds | readonly Kinds[],
  path: string,
) {
  const { mermaid } = builder.build({ lexer, entry, mermaid: true });

  writeFileSync(path, mermaid!);
}
