import { serializable } from "./json";
import { writeFileSync } from "fs";

// Usage: ts-node examples/parser/json/parser-data-gen.ts

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

writeFileSync("./examples/parser/json/dfa.json", dfaStr);
