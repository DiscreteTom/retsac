import { serializable } from "./advanced-builder";
import { writeFileSync } from "fs";

// Usage: ts-node example/advanced-builder/parser-data-gen.ts

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./example/advanced-builder/dfa.json", dfaStr);
