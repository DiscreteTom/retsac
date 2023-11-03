import { generateParserDataFile } from "../utils/parser-data-gen-common";
import { builder, entry } from "./json";

// Usage: ts-node examples/parser/json/parser-data-gen.ts

generateParserDataFile(builder, entry, "./examples/parser/json/dfa.json");
