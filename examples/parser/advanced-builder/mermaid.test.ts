import { readFileSync } from "fs";
import { lexer, builder } from "./advanced-builder";

const cache = readFileSync(
  "./examples/parser/advanced-builder/dfa.mmd",
  "utf8",
);

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, mermaid: true });
  expect(mermaid).toBe(cache);
});
