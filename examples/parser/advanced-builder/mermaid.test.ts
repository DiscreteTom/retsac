import { readFileSync } from "fs";
import { lexer, builder, entry } from "./advanced-builder";

const cache = readFileSync(
  "./examples/parser/advanced-builder/dfa.mmd",
  "utf8",
);

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, entry, mermaid: true });
  expect(mermaid).toBe(cache);
});
