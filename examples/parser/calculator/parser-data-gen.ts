import { generateParserDataFile } from "../utils/parser-data-gen-common";
import { builder, entry } from "./calculator";

// Usage: ts-node examples/parser/calculator/parser-data-gen.ts

generateParserDataFile(builder, entry, "./examples/parser/calculator/dfa.json");
