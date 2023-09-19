import { lexer, builder, cache } from "./simple-ts-parser";
import { readFileSync } from "fs";

test("simple-ts-parser", () => {
  // process the source file
  const code = readFileSync(
    "./examples/parser/simple-ts-parser/simple-ts-parser.ts",
    "utf-8",
  );

  const { parser } = builder.build(lexer, {
    checkAll: true,
    hydrate: cache,
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
