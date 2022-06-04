import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import { exact } from "../src/lexer/utils";
import { SimpleNodeReducer, valueReducer } from "../src/parser/simple/reducer";

let lexer = new Lexer()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(exact(..."+-*/()"));

let parser = new Parser(lexer).addNodeReducer(
  new SimpleNodeReducer()
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
    .compile()
);

function assertEqual(input: string, desired: number) {
  parser.reset();
  let res = parser.parse(input);
  if (res.length != 1)
    throw new Error(`Reduce failed for input "${input}". Result: ${res}`);
  if (res[0].data.value != desired)
    throw new Error(
      `Wrong result. Input: "${input}", want: ${desired}, got: ${res[0].data.value}`
    );
}

assertEqual("1+1", 2);
assertEqual("-1-2", -3);
assertEqual("1 - -1", 2);
assertEqual("2+3*4/5", 4.4);
assertEqual("(2+3)*4/5", 4);

console.log("All check passed.");
