import { generateParserDataFile } from "../utils/parser-data-gen";
import { lexer, builder } from "./json";

// Usage: ts-node examples/parser/json/parser-data-gen.ts

generateParserDataFile(builder, lexer, "./examples/parser/json/dfa.json");
