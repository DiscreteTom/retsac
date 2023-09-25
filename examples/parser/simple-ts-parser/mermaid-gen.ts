import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { lexer, builder } from "./simple-ts-parser";

// Usage: ts-node examples/parser/simple-ts-parser/mermaid-gen.ts

generateMermaidFile(
  builder,
  lexer,
  "./examples/parser/simple-ts-parser/dfa.mmd",
);
