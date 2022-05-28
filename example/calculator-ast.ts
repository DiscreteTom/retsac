import { Lexer } from "../src/lexer/lexer";
import { Builder } from "../src/parser/builder";
import * as readline from "readline";
import { ASTNode } from "../src/parser/ast";

let parser = new Builder()
  .setLexer(
    Lexer.ignore(/^\s/)
      .define({
        number: /^[0-9]+(?:\.[0-9]+)?/,
      })
      .literal(..."+-*/()".split(""))
  )
  .define({ exp: "number" })
  .define({ exp: `'-' exp` }, (_, context) => {
    let p = context.before.at(-1); // previous token or AST node
    if (p && p instanceof ASTNode && p.type == "exp") context.reject = true;
  })
  .define({
    exp: [
      `'(' exp ')'`,
      `exp '*' exp`,
      `exp '/' exp`,
      `exp '+' exp`,
      `exp '-' exp`,
    ].join("|"),
  })
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
    console.log(res[0].toString());
    parser.reset();
  }
  rl.prompt();
});

rl.prompt();
