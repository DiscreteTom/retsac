import { lexer, builder } from "./simple-ts-parser";
import { readFileSync } from "fs";

test("simple-ts-parser", () => {
  // process the source file
  const code = readFileSync("./examples/parser/simple-ts-parser.ts", "utf-8");

  const { parser } = builder.build(lexer, { checkAll: true });
  parser.feed(code);

  while (true) {
    // parse one top level statement at a time
    if (!parser.parse().accept) break;
  }

  expect(parser.buffer.length).toBe(0);
  expect(parser.lexer.hasRest()).toBe(false);
});
