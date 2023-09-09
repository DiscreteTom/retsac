import { writeFileSync } from "fs";
import { grammarParserFactory } from "../src/parser/ELR/advanced/utils/advanced-grammar-parser";
import util from "node:util";

// Usage: ts-node utils/generate-serialized-grammar-parser.ts

// use these to generate serialized grammar parser
const { lexer, parserBuilder } = grammarParserFactory("__");
parserBuilder.build(lexer, { checkAll: true, serialize: true });
const content = [
  `// generated by utils/generate-serialized-grammar-parser.ts`,
  `import { SerializableParserData } from "../../model";`,
  "",
  `export const data = ${util.inspect(parserBuilder.serializable, {
    depth: Infinity,
  })} as SerializableParserData;`,
].join("\n");

writeFileSync(
  "src/parser/ELR/advanced/utils/serialized-grammar-parser-data.ts",
  content,
  "utf-8"
);