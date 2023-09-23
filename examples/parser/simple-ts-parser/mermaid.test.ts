import { readFileSync } from "fs";
import { lexer, builder } from "./simple-ts-parser";

const cache = readFileSync(
  "./examples/parser/simple-ts-parser/dfa.mmd",
  "utf8",
);

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, mermaid: true });
  expect(mermaid).toBe(cache);
});
