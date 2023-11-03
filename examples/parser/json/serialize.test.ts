import { generateParserDataString } from "../utils/parser-data-gen-common";
import { builder, cacheStr, entry } from "./json";

test("serialize", () => {
  expect(generateParserDataString(builder, entry)).toBe(cacheStr);
});
