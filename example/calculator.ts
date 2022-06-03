import { Lexer } from "../src/lexer/lexer";
import { Parser } from "../src/parser/parser";
import * as readline from "readline";
import { ASTNode } from "../src/parser/ast";
import { exact } from "../src/lexer/utils";
import { SimpleReducer, valueReducer } from "../src/parser/simple";

let parser = new Parser()
  .setLexer(
    new Lexer()
      .ignore(/^\s/)
      .define({
        number: /^[0-9]+(?:\.[0-9]+)?/,
      })
      .anonymous(exact(..."+-*/()"))
  )
  .addRule(
    new SimpleReducer()
      .define(
        { exp: "number" },
        ({ data, matched }) => (data.value = Number(matched[0].text))
      )
      .define({ exp: `'-' exp` }, (context) => {
        // if previous node is an exp, the `- exp` should be `exp - exp`, reject
        if (context.before.at(-1)?.type == "exp") return "reject";
        // else, no previous, or previous is not exp
        context.data.value = -context.matched[1].data.value;
      })
      .define(
        { exp: `'(' exp ')'` },
        valueReducer((values) => values[1])
      )
      .define({ exp: `exp '+' exp` }, ({ after, data, matched }) => {
        if (after[0]?.text == "*" || after[0]?.text == "/") return "reject";
        data.value = matched[0].data.value + matched[2].data.value;
      })
      .define({ exp: `exp '-' exp` }, ({ after, data, matched }) => {
        if (after[0]?.text == "*" || after[0]?.text == "/") return "reject";
        data.value = matched[0].data.value - matched[2].data.value;
      })
      .define(
        { exp: `exp '*' exp` },
        valueReducer((values) => values[0] * values[2])
      )
      .define(
        { exp: `exp '/' exp` },
        valueReducer((values) => values[0] / values[2])
      )
      .compile()
  );

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  let res = parser.parse(line + "\n");
  if (res.length == 1 && res[0] instanceof ASTNode) {
    console.log(res[0].data.value);
    parser.reset();
  }
  rl.prompt();
});

rl.prompt();
