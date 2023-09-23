import { lexer, builder } from "./core";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/calculator/mermaid-gen.ts

const { mermaid } = builder.build({ lexer, mermaid: true });

writeFileSync("./examples/parser/calculator/dfa.mmd", mermaid!);
