import { readFileSync } from "fs";
import { lexer, builder } from "./core";

function stringify(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

const cache = readFileSync("./examples/parser/calculator/dfa.mmd", "utf8");

test("serialize", () => {
  const { mermaid } = builder.build(lexer, { mermaid: true });
  expect(mermaid).toBe(stringify(cache));
});
