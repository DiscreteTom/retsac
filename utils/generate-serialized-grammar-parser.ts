import { writeFileSync } from "fs";
import { grammarParserFactory } from "../src/parser/ELR/advanced/utils/advanced-grammar-parser";
import prettier from "prettier";
import util from "node:util";

// Usage: ts-node utils/generate-serialized-grammar-parser.ts

// use these to generate serialized grammar parser
const { lexer, parserBuilder } = grammarParserFactory("__");
const { serializable } = parserBuilder.build(lexer, {
  checkAll: true,
  serialize: true,
});
const content = [
  `// generated by utils/generate-serialized-grammar-parser.ts`,
  `import type { SerializableParserData } from "../../model";`,
  "",
  `export const data: SerializableParserData<"gr", "" | "rename" | "grammar" | "literal"> = ${util.inspect(
    serializable,
    { depth: Infinity },
  )};`,
].join("\n");

prettier.format(content, { parser: "typescript" }).then((content) => {
  writeFileSync(
    "src/parser/ELR/advanced/utils/serialized-grammar-parser-data.ts",
    content,
    "utf-8",
  );
});
