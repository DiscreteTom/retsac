import { lexer, builder, entry } from "./json";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(generateMermaidString(builder, lexer, entry)).toBe(
    loadMermaidString("./examples/parser/json/dfa.mmd"),
  );
});
