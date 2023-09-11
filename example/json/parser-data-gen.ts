import { serializable } from "./json";
import { writeFileSync } from "fs";

// Usage: ts-node example/json/parser-data-gen.ts

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./example/json/dfa.json", dfaStr);
