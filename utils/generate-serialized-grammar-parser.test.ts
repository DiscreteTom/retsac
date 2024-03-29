import {
  grammarParserFactory,
  entry,
} from "../src/parser/ELR/advanced/utils/grammar-parser-factory";
import { data } from "../src/parser/ELR/advanced/utils/serialized-grammar-parser-data";

test("generate serialized grammar parser", async () => {
  // use these to generate serialized grammar parser
  const { parserBuilder } = grammarParserFactory("__");
  const { serializable } = parserBuilder.build({
    entry,
    checkAll: true,
    serialize: true,
  });

  expect(serializable).toEqual(data);
});
