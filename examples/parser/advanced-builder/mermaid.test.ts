import { lexer, builder, entry } from "./advanced-builder";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(generateMermaidString(builder, lexer, entry)).toBe(
    loadMermaidString("./examples/parser/advanced-builder/dfa.mmd"),
  );
});
