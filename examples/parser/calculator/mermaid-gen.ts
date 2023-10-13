import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { lexer, builder, entry } from "./calculator";

// Usage: ts-node examples/parser/calculator/mermaid-gen.ts

generateMermaidFile(
  builder,
  lexer,
  entry,
  "./examples/parser/calculator/dfa.mmd",
);
