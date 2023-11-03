import { generateParserDataString } from "../utils/parser-data-gen-common";
import { builder, cacheStr, entry } from "./advanced-builder";

test("serialize", () => {
  expect(generateParserDataString(builder, entry) === cacheStr).toBe(true);
});
