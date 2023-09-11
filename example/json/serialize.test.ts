import { readFileSync } from "fs";
import { serializable } from "./json";

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

test("serialize json parser", () => {
  expect(dfaStr).toBe(readFileSync("./example/json/dfa.json", "utf-8"));
});
