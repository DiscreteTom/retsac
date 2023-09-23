import { generateParserDataFile } from "../utils/parser-data-gen";
import { lexer, builder } from "./advanced-builder";

// Usage: ts-node examples/parser/advanced-builder/parser-data-gen.ts

generateParserDataFile(
  builder,
  lexer,
  "./examples/parser/advanced-builder/dfa.json",
);
