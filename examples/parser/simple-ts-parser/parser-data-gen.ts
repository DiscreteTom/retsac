import { generateParserDataFile } from "../utils/parser-data-gen";
import { lexer, builder } from "./simple-ts-parser";

// Usage: ts-node examples/parser/simple-ts-parser/parser-data-gen.ts

generateParserDataFile(
  builder,
  lexer,
  "./examples/parser/simple-ts-parser/dfa.json",
);
