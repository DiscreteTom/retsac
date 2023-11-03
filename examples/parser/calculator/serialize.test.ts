import { generateParserDataString } from "../utils/parser-data-gen-common";
import { builder, cacheStr, entry } from "./calculator";

test("serialize", () => {
  expect(generateParserDataString(builder, entry)).toBe(cacheStr);
});
