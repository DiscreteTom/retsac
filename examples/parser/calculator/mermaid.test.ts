import { lexer, builder, entry } from "./core";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(generateMermaidString(builder, lexer, entry)).toBe(
    loadMermaidString("./examples/parser/calculator/dfa.mmd"),
  );
});
