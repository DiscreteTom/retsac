import { Lexer, LR, ParserManager } from "../../src";

let lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

export let parser = new ParserManager().setLexer(lexer).add(
  new LR.LRParserBuilder()
    .entry("exp")
    .define(
      { exp: "number" },
      LR.valueReducer((_, { matched }) => Number(matched[0].text))
    )
    .define(
      { exp: `'-' exp` },
      LR.valueReducer((values) => -values[1]),
      // if previous node is an exp, the `- exp` should be `exp - exp`, reject
      ({ before }) => before.at(-1)?.type == "exp"
    )
    .define(
      { exp: `'(' exp ')'` },
      LR.valueReducer((values) => values[1])
    )
    .define(
      { exp: `exp '+' exp | exp '-' exp` },
      LR.valueReducer((values, { matched }) =>
        matched[1].text == "+" ? values[0] + values[2] : values[0] - values[2]
      ),
      ({ after }) => after[0]?.text == "*" || after[0]?.text == "/"
    )
    .define(
      { exp: `exp '*' exp | exp '/' exp` },
      LR.valueReducer((values, { matched }) =>
        matched[1].text == "*" ? values[0] * values[2] : values[0] / values[2]
      )
    )
    .checkSymbols(lexer.getTokenTypes())
    .build()
);
