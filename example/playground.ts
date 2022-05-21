import { Lexer } from "../src/lexer";
import * as readline from "readline";

let lexer = Lexer.define({
  number: /^[0-9]+(?:\.[0-9]+)?\b/,
}).ignore(/^[ \n\r\t]+/, "blank");

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
