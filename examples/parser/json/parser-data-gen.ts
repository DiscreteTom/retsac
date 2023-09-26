import { generateParserDataFile } from "../utils/parser-data-gen-common";
import { lexer, builder, entry } from "./json";

// Usage: ts-node examples/parser/json/parser-data-gen.ts

generateParserDataFile(
  builder,
  lexer,
  entry,
  "./examples/parser/json/dfa.json",
);
