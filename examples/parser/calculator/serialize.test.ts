import { generateParserDataString } from "../utils/parser-data-gen-common";
import { lexer, builder, cacheStr, entry } from "./calculator";

test("serialize", () => {
  expect(generateParserDataString(builder, lexer, entry)).toBe(cacheStr);
});
