import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { lexer, builder } from "./json";

// Usage: ts-node examples/parser/json/mermaid-gen.ts

generateMermaidFile(builder, lexer, "./examples/parser/json/dfa.mmd");
