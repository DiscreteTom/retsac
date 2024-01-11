import { writeFileSync } from "fs";
import {
  grammarParserFactory,
  entry,
} from "../src/parser/ELR/advanced/utils/grammar-parser-factory";
import prettier from "prettier";

// Usage: ts-node utils/generate-serialized-grammar-parser.ts

// use these to generate serialized grammar parser
const { parserBuilder } = grammarParserFactory("__");
const { serializable } = parserBuilder.build({
  entry,
  checkAll: true,
  serialize: true,
});
const content = [
  `// generated by utils/generate-serialized-grammar-parser.ts`,
  "",
  "// comment all lines and uncomment the next line to re-generate the data",
  "// export const data = undefined;",
  "",
  `import type { ExtractSerializableParserData } from "../../model";`,
  `import type { GrammarParserBuilder } from "./grammar-parser-factory";`,
  "",
  `export const data: ExtractSerializableParserData<GrammarParserBuilder> = ${JSON.stringify(
    serializable,
  )};`,
].join("\n");

prettier.format(content, { parser: "typescript" }).then((content) => {
  writeFileSync(
    "src/parser/ELR/advanced/utils/serialized-grammar-parser-data.ts",
    content,
    "utf-8",
  );
});
