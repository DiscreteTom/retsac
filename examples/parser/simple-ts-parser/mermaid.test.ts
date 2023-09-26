import { readFileSync } from "fs";
import { lexer, builder, entry } from "./simple-ts-parser";

const cache = readFileSync(
  "./examples/parser/simple-ts-parser/dfa.mmd",
  "utf8",
);

test("serialize", () => {
  const { mermaid } = builder.build({ lexer, entry, mermaid: true });
  expect(mermaid).toBe(cache);
});
