import { serializable } from "./core";
import { writeFileSync } from "fs";

const dfaStr = JSON.stringify(serializable);

writeFileSync("./example/calculator/dfa.json", dfaStr);
