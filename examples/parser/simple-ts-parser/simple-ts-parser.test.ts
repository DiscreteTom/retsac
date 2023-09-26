import { loadCache } from "../utils/parser-data-gen-common";
import { lexer, builder, entry } from "./simple-ts-parser";
import { readFileSync } from "fs";

const { cache } = loadCache("./examples/parser/simple-ts-parser/dfa.json");

test("simple-ts-parser", () => {
  // process the source file
  const code = readFileSync(
    "./examples/parser/simple-ts-parser/simple-ts-parser.ts",
    "utf-8",
  );

  const { parser } = builder.build({
    lexer,
    entry,
    checkAll: true,
    hydrate: cache,
    ignoreEntryFollow: true,
    // debug: true,
  });
  parser.feed(code);

  while (true) {
    // parse one top level statement at a time
    if (!parser.parse().accept) break;
    // TODO: optimize the take function's return value
    parser.take()[0];
  }

  expect(parser.buffer).toEqual([]);
  expect(parser.lexer.getRest()).toBe("");
});
