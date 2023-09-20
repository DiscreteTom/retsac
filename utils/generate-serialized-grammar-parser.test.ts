import { grammarParserFactory } from "../src/parser/ELR/advanced/utils/grammar-expander";
import { data } from "../src/parser/ELR/advanced/utils/serialized-grammar-parser-data";

test("generate serialized grammar parser", async () => {
  // use these to generate serialized grammar parser
  const { lexer, parserBuilder } = grammarParserFactory("__");
  const { serializable } = parserBuilder.build(lexer, {
    checkAll: true,
    serialize: true,
  });

  expect(serializable).toEqual(data);
});
