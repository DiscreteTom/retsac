import { builder, lexer, cache, entry } from "./calculator";

const { parser } = builder.build({
  lexer,
  entry,
  hydrate: cache,
});
const res = parser.parseAll("2+3*(4/5)");
if (!res.accept || res.buffer.length != 1)
  throw new Error(
    `Reduce failed for input. Result: ${parser.buffer
      .map((node) => node.toString())
      .join(" ")}`,
  );

console.log(res.buffer[0].toTreeString());
