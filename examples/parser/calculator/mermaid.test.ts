import { readFileSync } from "fs";
import { lexer, builder } from "./core";

const cache = readFileSync("./examples/parser/calculator/dfa.mmd", "utf8");

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, mermaid: true });
  expect(mermaid).toBe(cache);
});
