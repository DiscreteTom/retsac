import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { builder, entry } from "./advanced-builder";

// Usage: ts-node examples/parser/advanced-builder/mermaid-gen.ts

generateMermaidFile(
  builder,
  entry,
  "./examples/parser/advanced-builder/dfa.mmd",
);
