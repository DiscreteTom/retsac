import { Lexer, ELR } from "../../src";

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

export const parser = new ELR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    ELR.reducer(({ matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `'-' exp` },
    ELR.reducer(({ values }) => -values[1]!)
  )
  .define(
    { exp: `'(' exp ')'` },
    ELR.reducer(({ values }) => values[1])
  )
  .define(
    { exp: `exp '+' exp` },
    ELR.reducer(({ values }) => values[0]! + values[2]!)
  )
  .define(
    { exp: `exp '-' exp` },
    ELR.reducer(({ values }) => values[0]! - values[2]!)
  )
  .define(
    { exp: `exp '*' exp` },
    ELR.reducer(({ values }) => values[0]! * values[2]!)
  )
  .define(
    { exp: `exp '/' exp` },
    ELR.reducer(({ values }) => values[0]! / values[2]!)
  )
  .priority(
    { exp: `'-' exp` }, // highest priority
    [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
    [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }] // lowest priority
  )
  .leftSA(
    // left-self-associative, e.g. 1 - 2 - 3 = (1 - 2) - 3 instead of 1 - (2 - 3)
    { exp: `exp '*' exp` },
    { exp: `exp '/' exp` },
    { exp: `exp '+' exp` },
    { exp: `exp '-' exp` }
  )
  .build(lexer, { checkAll: true });
