import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { lexer, builder } from "./core";

// Usage: ts-node examples/parser/calculator/mermaid-gen.ts

generateMermaidFile(builder, lexer, "./examples/parser/calculator/dfa.mmd");
