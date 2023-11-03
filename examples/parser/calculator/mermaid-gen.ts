import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { builder, entry } from "./calculator";

// Usage: ts-node examples/parser/calculator/mermaid-gen.ts

generateMermaidFile(builder, entry, "./examples/parser/calculator/dfa.mmd");
