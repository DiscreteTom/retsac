import { readFileSync, writeFileSync } from "fs";
import type { BuildOptions, IParserBuilder } from "../../../src/parser/ELR";
import type { GeneralTokenDataBinding } from "../../../src/lexer";

export function generateMermaidString<
  NTs extends string,
  ASTData,
  ErrorType,
  LexerDataBindings extends GeneralTokenDataBinding,
  LexerActionState,
  LexerError,
  Global,
>(
  builder: IParserBuilder<
    NTs,
    ASTData,
    ErrorType,
    LexerDataBindings,
    LexerActionState,
    LexerError,
    Global
  >,
  entry: NTs | readonly NTs[],
) {
  const { mermaid } = builder.build({ entry, mermaid: true } as BuildOptions<
    NTs,
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
  writeFileSync(path, generateMermaidString(builder, entry));
}

export function loadMermaidString(path: string) {
  return readFileSync(path, "utf8").replace(/\r/g, ""); // remove '\r' for Windows
}
