import { ASTNode } from "../../../src/parser";
import { InvalidTraverseError } from "../../../src/parser/error";

test("invalid traverse error", () => {
  const node = ASTNode.from({ content: "123", kind: "num", start: 0 });
  expect(() => node.traverse()).toThrow(InvalidTraverseError);
});
