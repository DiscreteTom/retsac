import { ELR, Lexer } from "../../../src";

test("Terminator's follow sets are needed", () => {
  expect(() => {
    new ELR.ParserBuilder()
      .define({
        // when we calculate follow set, the terminator's follow set is needed as well.
        // in the following example, the follow set of `b` is needed, and the value is [`c`]
        // so we can know that `c` should also be in the follow set of `test`
        // then when we check conflicts, we can detect the R-S conflict between `a b` and `a b c`
        test: `a b | a b c`,
        test2: `test c`,
      })
      .build({
        lexer: new Lexer.Builder().build(),
        entry: ["test", "test2"],
        checkConflicts: true,
      });
  }).toThrow(`Unresolved R-S conflict`);
});
