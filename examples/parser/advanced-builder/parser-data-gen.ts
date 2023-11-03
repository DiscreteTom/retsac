import { generateParserDataFile } from "../utils/parser-data-gen-common";
import { builder, entry } from "./advanced-builder";

// Usage: ts-node examples/parser/advanced-builder/parser-data-gen.ts

generateParserDataFile(
  builder,
  entry,
  "./examples/parser/advanced-builder/dfa.json",
);
