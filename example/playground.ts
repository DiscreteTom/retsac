import * as readline from "readline";
import { ASTNode } from "../src/parser/ast";
import { parser } from "./calculator/core";

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
