import { readFileSync, writeFileSync } from "fs";
import type { BuildOptions, IParserBuilder } from "../../../src/parser/ELR";
import type { GeneralTokenDataBinding } from "../../../src/lexer";

export function generateMermaidString<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
>(
  builder: IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
  entry: Kinds | readonly Kinds[],
) {
  const { mermaid } = builder.build({ entry, mermaid: true } as BuildOptions<
    Kinds,
    LexerDataBindings
  >);
  return mermaid!;
}

export function generateMermaidFile<
  Kinds extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
>(
  builder: IParserBuilder<
    Kinds,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError
  >,
  entry: Kinds | readonly Kinds[],
  path: string,
) {
  writeFileSync(path, generateMermaidString(builder, entry));
}

export function loadMermaidString(path: string) {
  return readFileSync(path, "utf8").replace(/\r/g, ""); // remove '\r' for Windows
}
