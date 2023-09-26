import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { lexer, builder, entry } from "./json";

// Usage: ts-node examples/parser/json/mermaid-gen.ts

generateMermaidFile(builder, lexer, entry, "./examples/parser/json/dfa.mmd");
