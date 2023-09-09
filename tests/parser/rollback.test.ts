import { ELR, Lexer } from "../../src";
import { rollback } from "../../src/parser/ELR";

test("Ensure no rollback if rollback is disabled", () => {
  expect(() => {
    new ELR.ParserBuilder()
      .define(
        { test: `a b | a b c` },
        rollback(() => "")
      )
      .entry("test")
      .build(new Lexer.Builder().build(), {
        checkRollback: true,
      });
  }).toThrow(); // TODO: type this
});
