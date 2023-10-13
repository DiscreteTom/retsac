import { Lexer, ELR } from "../../../src";
import { loadCache } from "../utils/parser-data-gen-common";

export const { cacheStr, cache } = loadCache(
  "./examples/parser/calculator/dfa.json",
);

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
  );

export const entry = "exp" as const;
