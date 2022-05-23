import { Lexer } from "../src/lexer/lexer";
import * as readline from "readline";
import { exact, from_to } from "../src/lexer/utils";
import { ASTNode } from "../src/parser/ast";
import { Parser } from "../src/parser/parser";

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

let parser = new Parser(lexer).simple({
  // expression
  exp: "grammar | grouped_exp | any_exp | oneOrMore_exp | maybe_exp | or_exp",
  any_exp: "exp any",
  oneOrMore_exp: "exp oneOrMore",
  maybe_exp: "exp maybe",
  grouped_exp: "groupL exp groupR",
  or_exp: "exp or exp",
});

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  if (line == "reset") {
    parser.reset();
    console.log("done");
  } else {
    let res = parser.parse(line + "\n");
    res.map((r) => {
      if (r instanceof ASTNode) console.log(r.toString());
      else console.log(r);
    });
  }
  rl.prompt();
});

rl.prompt();
