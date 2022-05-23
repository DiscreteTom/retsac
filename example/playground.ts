import { Lexer } from "../src/lexer";
import * as readline from "readline";
import { exact, from_to } from "../src/lexer_utils";
import { Builder } from "../src/parser";
import { ASTNode } from "../src/ast";

let lexer = Lexer.ignore(
  /^\s/, // blank
  from_to("//", "\n", true), // single line comments
  from_to("/*", "*/", true) // multiline comments
).define({
  grammar: /^\w+/,
  or: exact("|"),
  any: exact("*"),
  oneOrMore: exact("+"),
  groupL: exact("("),
  groupR: exact(")"),
  maybe: exact("?"),
});

let parser = new Builder(lexer)
  .define({
    // expression
    exp: "grammar | grouped_exp | any_exp | oneOrMore_exp | maybe_exp | or_exp",
    or_exp: "exp or exp",
    any_exp: "exp any",
    oneOrMore_exp: "exp oneOrMore",
    grouped_exp: "groupL exp groupR",
    maybe_exp: "exp maybe",
  })
  .compile();

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  if (line == "reset") {
    parser.reset();
    return;
  }
  let res = parser.parse(line + "\n");
  res.map((r) => {
    if (r instanceof ASTNode) console.log(r.toString());
    else console.log(r);
  });
  rl.prompt();
});

rl.prompt();
