import { serializable } from "./core";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/calculator/parser-data-gen.ts

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./examples/parser/calculator/dfa.json", dfaStr);
