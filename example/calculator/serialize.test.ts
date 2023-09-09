import { readFileSync } from "fs";
import { serializable } from "./core";
import { writeFileSync } from "fs";

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

// writeFileSync("./example/calculator/dfa.json", dfaStr);

test("serialize calculator", () => {
  expect(dfaStr).toBe(readFileSync("./example/calculator/dfa.json", "utf-8"));
});
