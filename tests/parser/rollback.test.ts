import { ELR, Lexer } from "../../src";
import { RollbackDefinedWhileNotEnabledError } from "../../src/parser/ELR/builder/error";

test("Ensure no rollback if rollback is disabled", () => {
  expect(() => {
    new ELR.ParserBuilder({
      lexer: new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build(),
    })
      .define({ test: `a b | a b c` }, (d) => d.rollback(() => ""))
      .build({
        entry: "test",
        checkRollback: true,
      });
  }).toThrow(RollbackDefinedWhileNotEnabledError);
});
