import { readFileSync } from "fs";
import { serializable } from "./core";

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

test("serialize calculator", () => {
  expect(dfaStr).toBe(readFileSync("./example/calculator/dfa.json", "utf-8"));
});
