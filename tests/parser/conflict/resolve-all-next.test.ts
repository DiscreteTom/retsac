import { ELR, Lexer } from "../../../src";

test("Use '*' as next in RS conflict", () => {
  // not resolved
  expect(() => {
    new ELR.ParserBuilder()
      .define({
        test: `a b | a b c`,
        test2: `test c`,
      })
      .entry("test", "test2")
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).toThrow(`Unresolved R-S conflict`);
  // resolved
  expect(() => {
    new ELR.ParserBuilder()
      .define({
        test: `a b | a b c`,
        test2: `test c`,
      })
      .entry("test", "test2")
      .resolveRS({ test: `a b` }, { test: `a b c` }, { next: `*` })
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).not.toThrow(`Unresolved R-S conflict`);

  // advanced builder should auto generate resolvers using '*' as the next
  expect(() => {
    new ELR.AdvancedBuilder()
      .define({
        test: `a b c?`,
        test2: `test c`,
      })
      .entry("test", "test2")
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).not.toThrow(`Unresolved R-S conflict`);
});

test("Use '*' as next in RR conflict", () => {
  // not resolved
  expect(() => {
    new ELR.ParserBuilder()
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .entry("entry")
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).toThrow(`Unresolved R-R conflict`);
  // resolved
  expect(() => {
    new ELR.ParserBuilder()
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .entry("test")
      .resolveRR(
        { test: `a b c` },
        { test: `b c` },
        { next: `*`, handleEnd: true },
      )
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).not.toThrow(`Unresolved R-R conflict`);

  // advanced builder should auto generate resolvers using '*'
  expect(() => {
    new ELR.AdvancedBuilder()
      .define({
        entry: `a test d | test d`,
        test: `a b c | b c`,
      })
      .entry("test")
      .build(new Lexer.Builder().build(), { checkConflicts: true });
  }).not.toThrow(`Unresolved R-R conflict`);
});
