import { ELR, Lexer } from "../../../src";

test("Use '*' as next in RS conflict", () => {
  // not resolved
  expect(() => {
    new ELR.ParserBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        test: `a b | a b c`,
        test2: `test c`,
      })
      .build({
        entry: ["test", "test2"],
        checkConflicts: true,
      });
  }).toThrow(`Unresolved R-S conflict`);
  // resolved
  expect(() => {
    new ELR.ParserBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        test: `a b | a b c`,
        test2: `test c`,
      })
      .resolveRS({ test: `a b` }, { test: `a b c` }, { next: `*` })
      .build({
        entry: ["test", "test2"],
        checkConflicts: true,
      });
  }).not.toThrow(`Unresolved R-S conflict`);

  // advanced builder should auto generate resolvers using '*' as the next
  expect(() => {
    new ELR.AdvancedBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        test: `a b c?`,
        test2: `test c`,
      })
      .build({
        entry: ["test", "test2"],
        checkConflicts: true,
      });
  }).not.toThrow(`Unresolved R-S conflict`);
});

test("Use '*' as next in RR conflict", () => {
  // not resolved
  expect(() => {
    new ELR.ParserBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .build({
        entry: "entry",
        checkConflicts: true,
      });
  }).toThrow(`Unresolved R-R conflict`);
  // resolved
  expect(() => {
    new ELR.ParserBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .resolveRR(
        { test: `a b c` },
        { test: `b c` },
        { next: `*`, handleEnd: true },
      )
      .build({
        entry: ["test"],
        checkConflicts: true,
      });
  }).not.toThrow(`Unresolved R-R conflict`);

  // advanced builder should auto generate resolvers using '*'
  expect(() => {
    new ELR.AdvancedBuilder()
      .lexer(new Lexer.Builder().define(Lexer.exactKind("a", "b", "c")).build())
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .build({
        entry: ["test"],
        checkConflicts: true,
      });
  }).not.toThrow(`Unresolved R-R conflict`);
});
