import { readFileSync } from "fs";
import { serializable } from "./advanced-builder";

const dfaStr = JSON.stringify(serializable, null, 2); // 2 spaces for indentation

test("serialize advanced builder", () => {
  expect(dfaStr).toBe(
    readFileSync("./example/advanced-builder/dfa.json", "utf-8")
  );
});
