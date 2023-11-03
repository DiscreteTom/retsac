import { ELR, Lexer, Logger } from "../../../src";
import { InvalidPlaceholderFollowError } from "../../../src/parser/ELR/advanced/error";

test("simple", () => {
  try {
    new ELR.AdvancedBuilder()
      .lexer(
        new Lexer.Builder()
          .anonymous(Lexer.whitespaces())
          .define(Lexer.exactKind(..."abc"))
          .build(),
      )
      .define({
        entry: `a+ a`,
      })
      .build({
        entry: "entry",
        checkAll: true,
      });
  } catch (_) {
    expect(_).toBeInstanceOf(InvalidPlaceholderFollowError);
    const e = _ as InvalidPlaceholderFollowError<"entry", "a">;
    expect(e.placeholderNT).toBe("__0");
    expect(e.grammarSnippet).toBe("a");
    expect(e.follows.grammars.size).toBe(1);
    expect(e.follows.grammars.has("a")).toBe(true);
  }
});

test("complex", () => {
  const printer = jest.fn();
  const logger = new Logger({ printer });
  new ELR.AdvancedBuilder()
    .lexer(
      new Lexer.Builder()
        .anonymous(Lexer.whitespaces())
        .define(Lexer.exactKind(..."abc"))
        .build(),
    )
    .define({
      entry: `(a b+)+ (a|b)`,
    })
    .build({
      entry: "entry",
      checkAll: true,
      printAll: true,
      logger,
    });

  expect(printer).toHaveBeenCalledWith(
    "[AdvancedBuilder] Placeholder rule { __0 := `b` } has invalid follow: b. You can modify your grammar rule or use reParse to fix this. See https://github.com/DiscreteTom/retsac/issues/22 for more details.",
  );
  expect(printer).toHaveBeenCalledWith(
    "[AdvancedBuilder] Placeholder rule { __1 := `a __0` } has invalid follow: a. You can modify your grammar rule or use reParse to fix this. See https://github.com/DiscreteTom/retsac/issues/22 for more details.",
  );
});
