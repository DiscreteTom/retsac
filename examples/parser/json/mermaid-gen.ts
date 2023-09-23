import { lexer, builder } from "./json";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/json/mermaid-gen.ts

const { mermaid } = builder.build({ lexer, mermaid: true });

writeFileSync("./examples/parser/json/dfa.mmd", mermaid!);
