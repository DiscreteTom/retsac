import { Lexer } from "../src/lexer";
import * as readline from "readline";
import { from_to } from "../src/lexer_utils";

let lexer = Lexer.ignore(
  /^[ \n\r\t]+/, // blank
  from_to("//", "\n", true), // single line comments
  from_to("/*", "*/", true) // multiline comments
).define({
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
  lexer.apply(console.log);
  rl.prompt();
});

rl.prompt();
