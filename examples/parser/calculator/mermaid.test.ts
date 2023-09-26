import { readFileSync } from "fs";
import { lexer, builder, entry } from "./core";

const cache = readFileSync("./examples/parser/calculator/dfa.mmd", "utf8");

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, entry, mermaid: true });
  expect(mermaid).toBe(cache);
});
