import { readFileSync } from "fs";
import { Lexer, ELR } from "../../../src";

export const cache = (() => {
  try {
    return JSON.parse(
      readFileSync("./examples/parser/calculator/dfa.json", "utf8"),
    );
  } catch {
    return undefined;
  }
})();

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

export const builder = new ELR.ParserBuilder<number>()
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text)),
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer(({ values }) => -values[1]!),
  )
  .define(
    { exp: `'(' exp ')'` },
    ELR.reducer(({ values }) => values[1]),
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.reducer(({ values }) => values[0]! + values[2]!),
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer(({ values }) => values[0]! - values[2]!),
  )
  .define(
    { exp: `exp '*' exp` },
    ELR.reducer(({ values }) => values[0]! * values[2]!),
  )
  .define(
    { exp: `exp '/' exp` },
    ELR.reducer(({ values }) => values[0]! / values[2]!),
  )
  .priority(
    { exp: `'-' exp` }, // highest priority
    [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
    [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }], // lowest priority
  )
  .entry("exp");

export const { parser } = builder.build(lexer, {
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // this should be set to `true` in development
  checkAll: true,
});
