import { readFileSync } from "fs";
import { Lexer, ELR } from "../../../src";
import { SerializableParserData } from "../../../src/parser/ELR";

const cache = (() => {
  try {
    return JSON.parse(
      readFileSync("./examples/parser/calculator/dfa.json", "utf8")
    ) as SerializableParserData;
  } catch {
    return undefined;
  }
})();

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({
    number: /[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

const builder = new ELR.ParserBuilder<number>()
  .useLexerKinds(lexer)
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
  .entry("exp");

export const parser = builder.build(lexer, {
  // use the cached data to speed up
  // this is recommended in production
  hydrate: cache,
  // serialize the data for future use in `hydrate`
  // this is should be done before production
  serialize: true,
  // this should be set to `true` in development
  checkAll: true,
});

// since the `serialize` option is set to `true`,
// we can get the serializable data from the builder
export const serializable = builder.serializable;
