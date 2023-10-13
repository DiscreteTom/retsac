import { readFileSync, writeFileSync } from "fs";
import type { IParserBuilder } from "../../../src/parser/ELR";
import type { ILexer } from "../../../src/lexer";

export function generateMermaidString<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  AppendLexerKinds extends string,
  LexerError,
  AppendLexerError,
  LexerActionState,
  AppendLexerActionState,
>(
  builder: IParserBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >,
  lexer: ILexer<
    LexerError | AppendLexerError,
    AppendLexerKinds,
    LexerActionState | AppendLexerActionState
  >,
  entry: Kinds | readonly Kinds[],
) {
  const { mermaid } = builder.build({ lexer, entry, mermaid: true });
  return mermaid!;
}

export function generateMermaidFile<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  AppendLexerKinds extends string,
  LexerError,
  AppendLexerError,
  LexerActionState,
  AppendLexerActionState,
>(
  builder: IParserBuilder<
    ASTData,
    ErrorType,
    Kinds,
    LexerKinds,
    LexerError,
    LexerActionState
  >,
  lexer: ILexer<
    LexerError | AppendLexerError,
    AppendLexerKinds,
    LexerActionState | AppendLexerActionState
  >,
  entry: Kinds | readonly Kinds[],
  path: string,
) {
  writeFileSync(path, generateMermaidString(builder, lexer, entry));
}

export function loadMermaidString(path: string) {
  return readFileSync(path, "utf8").replace(/\r/g, ""); // remove '\r' for Windows
}
