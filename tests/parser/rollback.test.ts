import { ELR, Lexer } from "../../src";
import { RollbackDefinedWhileNotEnabledError } from "../../src/parser/ELR/builder/error";

test("Ensure no rollback if rollback is disabled", () => {
  expect(() => {
    new ELR.ParserBuilder()
      .define({ test: `a b | a b c` }, (d) => d.rollback(() => ""))
      .build({
        lexer: new Lexer.Builder().build(),
        entry: "test",
        checkRollback: true,
      });
  }).toThrow(RollbackDefinedWhileNotEnabledError);
});
