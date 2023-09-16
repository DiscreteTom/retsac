import { lexer, builder } from "./simple-ts-parser";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/simple-ts-parser/parser-data-gen.ts

const { serializable } = builder.build(lexer, { serialize: true });
const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./examples/parser/simple-ts-parser/dfa.json", dfaStr);
