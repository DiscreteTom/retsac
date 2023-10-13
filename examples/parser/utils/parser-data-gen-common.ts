import { readFileSync, writeFileSync } from "fs";
import type { IParserBuilder } from "../../../src/parser/ELR";
import type { ILexer } from "../../../src/lexer";

function generateSerializable<
  ASTData,
  ErrorType,
  Kinds extends string,
  LexerKinds extends string,
  AppendLexerKinds extends string,
  LexerError,
  LexerActionState,
  AppendLexerError,
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
  const { serializable } = builder.build({ lexer, entry, serialize: true });
  return serializable;
}

function stringify(serializable: unknown) {
  return JSON.stringify(serializable, null, 2); // 2 spaces for indentation
}

export function generateParserDataString<
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
  const serializable = generateSerializable(builder, lexer, entry);
  return stringify(serializable);
}

export function generateParserDataFile<
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
  const dfaStr = generateParserDataString(builder, lexer, entry);

  writeFileSync(path, dfaStr);
}

function loadCacheString(path: string) {
  try {
    return readFileSync(path, "utf8").replace(/\r/g, ""); // remove \r for windows
  } catch {
    return undefined;
  }
}

function parseCacheString(cacheStr: string | undefined) {
  if (cacheStr === undefined) return undefined;
  try {
    return JSON.parse(cacheStr);
  } catch {
    return undefined;
  }
}

export function loadCache(path: string) {
  const cacheStr = loadCacheString(path);
  return { cache: parseCacheString(cacheStr), cacheStr };
}
