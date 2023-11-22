import { ASTNode } from "../../../src/parser";
import { InvalidTraverseError } from "../../../src/parser/error";

test("invalid traverse error", () => {
  const node = ASTNode.from({
    content: "123",
    kind: "num",
    start: 0,
    data: undefined,
  });
  expect(() => node.traverse()).toThrow(InvalidTraverseError);
});

// TODO: test StateCacheMissError by using a undefined anonymous literal in the input
