import { Lexer } from "../src/lexer";
import * as readline from "readline";

let lexer = Lexer.define({
  empty: /^[ \n\r]+/,
  number: /^[0-9]+(?:\.[0-9]+)?\b/,
});

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  lexer.feed(line + "\n");
  while (true) {
    let res = lexer.lex();
    if (res) console.log(res);
    else break;
  }
  rl.prompt();
});

rl.prompt();
