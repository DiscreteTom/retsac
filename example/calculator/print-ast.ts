import { parser } from "./core";

let res = parser.parseAll("2+3*(4/5)");
if (!res.accept || res.buffer.length != 1)
  throw new Error(
    `Reduce failed for input. Result: ${res.buffer
      .map((node) => node.toString())
      .join(" ")}`
  );

console.log(res.buffer[0].toTreeString());
