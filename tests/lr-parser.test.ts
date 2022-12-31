import { LR } from "../src";
import { ParserError } from "../src/parser/LR/error";

test("R-S conflict", () => {
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `exp A exp` })
      .define({ exp: `exp B` })
      .checkConflicts();
  }).toThrow(ParserError);

  // context style resolve
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define(
        { exp: `exp A exp` },
        LR.resolveRS({ exp: `exp B` }, { next: `B`, reduce: false }).resolveRS(
          { exp: `exp A exp` },
          { next: `A`, reduce: false }
        )
      )
      .define({ exp: `exp B` })
      .checkConflicts();
  }).not.toThrow(ParserError);

  // builder style resolve
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `exp A exp` })
      .define({ exp: `exp B` })
      .resolveRS(
        { exp: `exp A exp` },
        { exp: `exp B` },
        { next: `B`, reduce: false }
      )
      .resolveRS(
        { exp: `exp A exp` },
        { exp: `exp A exp` },
        { next: `A`, reduce: false }
      )
      .checkConflicts();
  }).not.toThrow(ParserError);
});

test("R-R conflict", () => {
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `C exp` })
      .define({ exp: `exp C exp` })
      .checkConflicts();
  }).toThrow(ParserError);

  // context style resolve
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define(
        { exp: `C exp` },
        LR.resolveRS({ exp: `exp C exp` }, { next: `C`, reduce: true })
      )
      .define(
        { exp: `exp C exp` },
        LR.resolveRR(
          { exp: `C exp` },
          { next: `C`, reduce: true, handleEnd: true }
        ).resolveRS({ exp: `exp C exp` }, { next: `C`, reduce: true })
      )
      .checkConflicts();
  }).not.toThrow(ParserError);

  // builder style resolve
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define({ exp: `C exp` })
      .define({ exp: `exp C exp` })
      .resolveRS(
        { exp: `C exp` },
        { exp: `exp C exp` },
        { next: `C`, reduce: true }
      )
      .resolveRR(
        { exp: `exp C exp` },
        { exp: `C exp` },
        { next: `C`, reduce: true, handleEnd: true }
      )
      .resolveRS(
        { exp: `exp C exp` },
        { exp: `exp C exp` },
        { next: `C`, reduce: true }
      )
      .checkConflicts();
  }).not.toThrow(ParserError);
});

test("conflict checker", () => {
  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define(
        { exp: `C exp` },
        LR.resolveRS({ exp: `exp C exp` }, { next: `C`, reduce: true })
      )
      .define(
        { exp: `exp C exp` },
        LR.resolveRR(
          { exp: `C exp` },
          { next: `C`, reduce: true, handleEnd: true }
        ).resolveRR(
          { exp: `exp C` }, // non-existing grammar rule
          { next: `C`, reduce: true, handleEnd: true }
        )
      )
      .checkConflicts();
  }).toThrow(ParserError);

  expect(() => {
    new LR.ParserBuilder()
      .entry("exp")
      .define(
        { exp: `C exp` },
        LR.resolveRS({ exp: `exp C exp` }, { next: `C`, reduce: true })
      )
      .define(
        { exp: `exp C exp` },
        LR.resolveRR(
          { exp: `C exp` },
          { next: `C B`, reduce: true, handleEnd: true } // non-existing token
        )
      )
      .checkConflicts();
  }).toThrow(ParserError);
});
