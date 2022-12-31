import { LR } from "../src";
import { ParserError } from "../src/parser/LR/error";

test("R-S conflict", () => {
  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define({ exp: `exp '+' exp` })
      .define({ exp: `exp '*'` })
      .checkConflicts();
  }).toThrow(ParserError);

  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `exp '+' exp` },
        LR.resolveRS({ exp: `exp '*'` }, { next: `'*'`, reduce: false })
      )
      .define({ exp: `exp '*'` })
      .checkConflicts();
  }).not.toThrow(ParserError);
});

test("R-R conflict", () => {
  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define({ exp: `'-' exp` })
      .define({ exp: `exp '-' exp` })
      .checkConflicts();
  }).toThrow(ParserError);

  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `'-' exp` },
        LR.resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      )
      .define(
        { exp: `exp '-' exp` },
        LR.resolveRR(
          { exp: `'-' exp` },
          { next: `'-'`, reduce: true, handleEnd: true }
        )
      )
      .checkConflicts();
  }).not.toThrow(ParserError);
});

test("conflict checker", () => {
  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `'-' exp` },
        LR.resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      )
      .define(
        { exp: `exp '-' exp` },
        LR.resolveRR<void>(
          { exp: `'-' exp` },
          { next: `'-'`, reduce: true, handleEnd: true }
        ).resolveRR(
          { exp: `exp '-'` }, // non-existing grammar rule
          { next: `'-'`, reduce: true, handleEnd: true }
        )
      )
      .checkConflicts();
  }).toThrow(ParserError);

  expect(() => {
    new LR.ParserBuilder<void>()
      .entry("exp")
      .define(
        { exp: `'-' exp` },
        LR.resolveRS({ exp: `exp '-' exp` }, { next: `'-'`, reduce: true })
      )
      .define(
        { exp: `exp '-' exp` },
        LR.resolveRR<void>(
          { exp: `'-' exp` },
          { next: `'-' '*'`, reduce: true, handleEnd: true } // non-existing token
        )
      )
      .checkConflicts();
  }).toThrow(ParserError);
});
