import { readFileSync } from "fs";
import { lexer, builder } from "./json";

const cache = readFileSync("./examples/parser/json/dfa.mmd", "utf8");

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, mermaid: true });
  expect(mermaid).toBe(cache);
});
