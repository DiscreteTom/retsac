import { Lexer } from "../src/lexer/lexer";
import { exact } from "../src/lexer/utils";
import { ParserManager } from "../src/parser/manager";
import { SimpleParserBuilder } from "../src/parser/simple/parser";
import { valueReducer } from "../src/parser/simple/reducer";

let lexer = new Lexer()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(exact(..."+-*/()"));

let parser = new ParserManager().setLexer(lexer).add(
  new SimpleParserBuilder()
    .define(
      { exp: "number" },
      valueReducer((_, { matched }) => Number(matched[0].text))
    )
    .define(
      { exp: `'-' exp` },
      valueReducer((values) => -values[1]),
      // if previous node is an exp, the `- exp` should be `exp - exp`, reject
      ({ before }) => before.at(-1)?.type == "exp"
    )
    .define(
      { exp: `'(' exp ')'` },
      valueReducer((values) => values[1])
    )
    .define(
      { exp: `exp '+' exp | exp '-' exp` },
      valueReducer((values, { matched }) =>
        matched[1].text == "+" ? values[0] + values[2] : values[0] - values[2]
      ),
      ({ after }) => after[0]?.text == "*" || after[0]?.text == "/"
    )
    .define(
      { exp: `exp '*' exp | exp '/' exp` },
      valueReducer((values, { matched }) =>
        matched[1].text == "*" ? values[0] * values[2] : values[0] / values[2]
      )
    )
    .checkSymbols(lexer.getTokenTypes())
    .build()
);

console.log(parser.parse("(2+3)*4/5")[0].toString());
