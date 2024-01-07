import { ELR, Lexer } from "../../../src";

test.each([`a b c?`, `a b c*`, `a b c+`, `a? b c d?`])(
  "Auto resolve conflicts when AdvancedBuilder.expand",
  (gr) => {
    expect(() => {
      new ELR.AdvancedBuilder({
        lexer: new Lexer.Builder()
          .define(Lexer.exactKind("a", "b", "c", "d"))
          .build(),
      })
        .define({
          test: gr,
        })
        .build({
          entry: "test",
          checkConflicts: true,
        });
    }).not.toThrow(`Unresolved R-S conflict`);
  },
);
