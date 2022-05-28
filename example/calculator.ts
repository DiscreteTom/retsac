import { Lexer } from "../src/lexer/lexer";
import { Builder } from "../src/parser/builder";
import * as readline from "readline";
import { ASTNode } from "../src/parser/ast";
import { valueReducer } from "../src/parser/reducer";

let parser = new Builder()
  .setLexer(
    Lexer.ignore(/^\s/)
      .define({
        number: /^[0-9]+(?:\.[0-9]+)?/,
      })
      .literal("+", "-", "*", "/", "(", ")")
  )
  .define(
    { exp: "number" },
    (node) => (node.data.value = Number(node.children[0].text))
  )
  .define({ exp: `'-' exp` }, (node, context) => {
    let p = context.before.at(-1); // previous token or AST node
    if (p && p instanceof ASTNode && p.type == "exp") {
      context.reject = true;
      return;
    }
    // else, no previous, or p is a token, or p is not exp
    node.data.value = -node.children[1].data.value;
  })
  .define(
    { exp: `'(' exp ')'` },
    valueReducer((values) => values[1])
  )
  .define(
    { exp: `exp '*' exp` },
    valueReducer((values) => values[0] * values[2])
  )
  .define(
    { exp: `exp '/' exp` },
    valueReducer((values) => values[0] / values[2])
  )
  .define(
    { exp: `exp '+' exp` },
    valueReducer((values) => values[0] + values[2])
  )
  .define(
    { exp: `exp '-' exp` },
    valueReducer((values) => values[0] - values[2])
  )
  .compile();

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
