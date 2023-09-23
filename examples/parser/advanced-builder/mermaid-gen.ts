import { generateMermaidFile } from "../utils/mermaid-gen";
import { lexer, builder } from "./advanced-builder";

// Usage: ts-node examples/parser/advanced-builder/mermaid-gen.ts

generateMermaidFile(
  builder,
  lexer,
  "./examples/parser/advanced-builder/dfa.mmd",
);
