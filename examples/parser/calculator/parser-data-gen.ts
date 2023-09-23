import { lexer, builder } from "./core";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/calculator/parser-data-gen.ts

const { serializable } = builder.build({ lexer, serialize: true });
const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./examples/parser/calculator/dfa.json", dfaStr);
