import * as readline from "readline";
import { manager } from "./calculator/core";

console.log(`This is a simple calculator.`);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  let res = manager.parseAll(line + "\n");
  if (res.accept && res.buffer.length == 1) {
    console.log(res.buffer[0].data.value);
    manager.reset();
  }
  rl.prompt();
});

rl.prompt();
