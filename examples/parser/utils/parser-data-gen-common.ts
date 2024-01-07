import { readFileSync, writeFileSync } from "fs";
import type { BuildOptions, IParserBuilder } from "../../../src/parser/ELR";
import type { GeneralTokenDataBinding } from "../../../src/lexer";

function generateSerializable<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
  Global,
>(
  builder: IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError,
    Global
  >,
  entry: Kinds | readonly Kinds[],
) {
  const { serializable } = builder.build({
    entry,
    serialize: true,
  } as BuildOptions<Kinds, LexerDataBindings>);
  return serializable;
}

function stringify(serializable: unknown) {
  return JSON.stringify(serializable, null, 2); // 2 spaces for indentation
}

export function generateParserDataString<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
  Global,
>(
  builder: IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError,
    Global
  >,
  entry: Kinds | readonly Kinds[],
) {
  const serializable = generateSerializable(builder, entry);
  return stringify(serializable);
}

export function generateParserDataFile<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
  Global,
>(
  builder: IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError,
    Global
  >,
  entry: Kinds | readonly Kinds[],
  path: string,
) {
  const dfaStr = generateParserDataString(builder, entry);

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
