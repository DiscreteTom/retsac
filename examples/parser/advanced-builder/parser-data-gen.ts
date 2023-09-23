import { lexer, builder } from "./advanced-builder";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/advanced-builder/parser-data-gen.ts

const { serializable } = builder.build({ lexer, serialize: true });
const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./examples/parser/advanced-builder/dfa.json", dfaStr);
