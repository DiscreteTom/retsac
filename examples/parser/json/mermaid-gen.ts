import { generateMermaidFile } from "../utils/mermaid-gen-common";
import { builder, entry } from "./json";

// Usage: ts-node examples/parser/json/mermaid-gen.ts

generateMermaidFile(builder, entry, "./examples/parser/json/dfa.mmd");
