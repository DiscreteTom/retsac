import { ELR, Lexer } from "../../src";
import { rollback } from "../../src/parser/ELR";
import { RollbackDefinedWhileNotEnabledError } from "../../src/parser/ELR/builder/error";

test("Ensure no rollback if rollback is disabled", () => {
  expect(() => {
    new ELR.ParserBuilder()
      .define(
        { test: `a b | a b c` },
        rollback(() => ""),
      )
      .entry("test")
      .build({ lexer: new Lexer.Builder().build(), checkRollback: true });
  }).toThrow(RollbackDefinedWhileNotEnabledError);
});
