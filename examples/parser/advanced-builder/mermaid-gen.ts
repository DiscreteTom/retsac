import { lexer, builder } from "./advanced-builder";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/advanced-builder/mermaid-gen.ts

const { mermaid } = builder.build(lexer, { mermaid: true });

writeFileSync("./examples/parser/advanced-builder/dfa.mmd", mermaid!);
