import { builder, entry } from "./calculator";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(
    generateMermaidString(builder, entry) ===
      loadMermaidString("./examples/parser/calculator/dfa.mmd"),
  ).toBe(true);
});
