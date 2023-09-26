import {
  generateParserDataString,
  loadCache,
} from "../utils/parser-data-gen-common";
import { builder, entry, lexer } from "./simple-ts-parser";

const { cacheStr } = loadCache("./examples/parser/simple-ts-parser/dfa.json");

test("serialize", () => {
  expect(generateParserDataString(builder, lexer, entry)).toBe(cacheStr);
});
