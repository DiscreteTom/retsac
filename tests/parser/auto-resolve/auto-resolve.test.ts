import { ELR, Lexer } from "../../../src";

test.each([`a b c?`, `a b c*`, `a b c+`, `a? b c d?`])(
  "Auto resolve conflicts when AdvancedBuilder.expand",
  (gr) => {
    expect(() => {
      new ELR.AdvancedBuilder()
        .define({
          test: gr,
        })
        .expand()
        .entry("test")
        .build(new Lexer.Builder().build(), { checkConflicts: true });
    }).not.toThrow(`Unresolved R-S conflict`);
  }
);