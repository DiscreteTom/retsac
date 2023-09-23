import { generateParserDataFile } from "../utils/parser-data-gen";
import { lexer, builder } from "./core";

// Usage: ts-node examples/parser/calculator/parser-data-gen.ts

generateParserDataFile(builder, lexer, "./examples/parser/calculator/dfa.json");
