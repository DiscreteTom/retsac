import { Lexer, ELR } from "../../../src";
import { loadCache } from "../utils/parser-data-gen-common";

export const { cacheStr, cache } = loadCache(
  "./examples/parser/calculator/dfa.json",
);

const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces()) // ignore blank characters
  .define({ number: /[0-9]+(?:\.[0-9]+)?/ })
  .anonymous(Lexer.exact(..."+-*/()")) // operators
  .build();

export const builder = new ELR.ParserBuilder({ lexer })
  .data<number>()
  .define({ exp: "number" }, (d) =>
    // the result of the reducer will be stored in the node's value
    d.reducer(({ matched }) => Number(matched[0].text)),
  )
  .define({ exp: `'-' exp` }, (d) => d.reducer(({ values }) => -values[1]!))
  .define({ exp: `'(' exp ')'` }, (d) => d.reducer(({ values }) => values[1]))
  .define({ exp: `exp '+' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! + values[2]!),
  )
  .define({ exp: `exp '-' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! - values[2]!),
  )
  .define({ exp: `exp '*' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! * values[2]!),
  )
  .define({ exp: `exp '/' exp` }, (d) =>
    d.reducer(({ values }) => values[0]! / values[2]!),
  )
  .priority(
    { exp: `'-' exp` }, // highest priority
    [{ exp: `exp '*' exp` }, { exp: `exp '/' exp` }],
    [{ exp: `exp '+' exp` }, { exp: `exp '-' exp` }], // lowest priority
  );

export const entry = "exp" as const;
