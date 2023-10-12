import { readFileSync } from "fs";
import { lexer, builder, entry } from "./simple-ts-parser";

// Usage: ts-node examples/parser/simple-ts-parser/log-gen.ts
// you'd better redirect the output to a file:
// ts-node examples/parser/simple-ts-parser/log-gen.ts > output.log

const { parser } = builder.build({
  lexer: lexer.dryClone(),
  entry,
  debug: true,
  checkAll: true,
  ignoreEntryFollow: true,
});

// process the source file
const code = readFileSync(
  "./examples/parser/simple-ts-parser/simple-ts-parser.ts",
  "utf-8",
);
parser.feed(code);

while (true) {
  // parse one top level statement at a time
  if (!parser.parse().accept) break;
  const stmt = parser.take()[0];
  console.log(stmt?.toTreeString());
}

if (parser.buffer.length) {
  console.log("===========  Unreduced  ===========");
  console.log(parser.buffer);
}

if (parser.lexer.hasRest()) {
  console.log(`===========  Undigested  ===========`);
  console.log(parser.lexer.getRest());
}
