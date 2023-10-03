import { lexer, builder, entry } from "./simple-ts-parser";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(generateMermaidString(builder, lexer, entry)).toBe(
    loadMermaidString("./examples/parser/simple-ts-parser/dfa.mmd"),
  );
});
