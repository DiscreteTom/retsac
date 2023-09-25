import { generateParserDataString } from "../utils/parser-data-gen-common";
import { lexer, builder, cacheStr } from "./advanced-builder";

test("serialize", () => {
  expect(generateParserDataString(builder, lexer)).toBe(cacheStr);
});
