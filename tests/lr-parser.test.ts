import { LR } from "../src";

test("R-S conflict", () => {
  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define({ exp: `exp '+' exp` })
      .define({ exp: `exp '*'` })
      .checkConflicts();
  }).toThrowError();

  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `exp '+' exp` },
        LR.resolveRS({ exp: `exp '*'` }, { next: `'*'`, reject: true })
      )
      .define({ exp: `exp '*'` })
      .checkConflicts();
  }).not.toThrowError();
});

test("R-R conflict", () => {
  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define({ exp: `'-' exp` })
      .define({ exp: `exp '-' exp` })
      .checkConflicts();
  }).toThrowError();

  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `'-' exp` },
        LR.resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reject: false })
      )
      .define(
        { exp: `exp '-' exp` },
        LR.resolveRR(
          { exp: `'-' exp` },
          { next: `'-'`, reject: false, end: true }
        )
      )
      .checkConflicts();
  }).not.toThrowError();
});
