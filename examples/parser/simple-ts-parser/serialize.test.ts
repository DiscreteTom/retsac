import {
  generateParserDataString,
  loadCache,
} from "../utils/parser-data-gen-common";
import { builder, lexer } from "./simple-ts-parser";

const { cacheStr } = loadCache("./examples/parser/simple-ts-parser/dfa.json");

test("serialize", () => {
  expect(generateParserDataString(builder, lexer)).toBe(cacheStr);
});
