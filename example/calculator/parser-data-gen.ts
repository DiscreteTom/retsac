import { serializable } from "./core";
import { writeFileSync } from "fs";

// Usage: ts-node example/calculator/parser-data-gen.ts

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./example/calculator/dfa.json", dfaStr);
