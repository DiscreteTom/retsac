import * as readline from "readline";
import { Parser } from "../src";
import { manager } from "./calculator/core";

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  let res = manager.parseAll(line + "\n");
  if (
    res.accept &&
    res.buffer.length == 1 &&
    res.buffer[0] instanceof Parser.ASTNode
  ) {
    console.log(res.buffer[0].data.value);
    manager.reset();
  }
  rl.prompt();
});

rl.prompt();
