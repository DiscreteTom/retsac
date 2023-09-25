import { generateParserDataString } from "../utils/parser-data-gen-common";
import { lexer, builder, cacheStr } from "./json";

test("serialize", () => {
  expect(generateParserDataString(builder, lexer)).toBe(cacheStr);
});
