import { builder, entry } from "./advanced-builder";
import {
  generateMermaidString,
  loadMermaidString,
} from "../utils/mermaid-gen-common";

test("serialize", () => {
  expect(
    generateMermaidString(builder, entry) ===
      loadMermaidString("./examples/parser/advanced-builder/dfa.mmd"),
  ).toBe(true);
});
