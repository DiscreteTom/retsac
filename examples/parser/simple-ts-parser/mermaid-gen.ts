import { lexer, builder } from "./simple-ts-parser";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/simple-ts-parser/mermaid-gen.ts

const { mermaid } = builder.build({ lexer, mermaid: true });

writeFileSync("./examples/parser/simple-ts-parser/dfa.mmd", mermaid!);
