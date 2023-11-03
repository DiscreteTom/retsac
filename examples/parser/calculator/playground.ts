import * as readline from "readline";
import { builder, cache, entry } from "./calculator";

const { parser } = builder.build({
  entry,
  hydrate: cache,
});

console.log(`This is a simple calculator.`);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
  prompt: ">>> ",
});

rl.on("line", function (line) {
  const res = parser.parseAll(line + "\n");
  if (res.accept && res.buffer.length === 1) {
    console.log(res.buffer[0].data);
    parser.reset();
  }
  rl.prompt();
});

rl.prompt();
