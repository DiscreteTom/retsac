import { ASTNode } from "../../src/parser";

test("from token", () => {
  const node = ASTNode.from({ content: "123", type: "num", start: 0 });
  expect(node.type).toBe("num");
  expect(node.start).toBe(0);
  expect(node.text).toBe("123");
  expect(node.children).toBe(undefined);
  expect(node.parent).toBe(undefined);
  expect(node.data).toBe(undefined);
  expect(node.error).toBe(undefined);
});

test("to obj", () => {
  const node1 = ASTNode.from({ content: "123", type: "num", start: 0 });
  const obj1 = node1.toObj();

  expect(obj1).toEqual({
    type: "num",
    start: 0,
    text: "123",
    children: [],
  });

  const node2 = new ASTNode({
    type: "exp",
    start: 0,
    children: [node1],
  });
  const obj2 = node2.toObj();

  expect(obj2).toEqual({
    type: "exp",
    start: 0,
    text: "",
    children: [
      {
        type: "num",
        start: 0,
        text: "123",
        children: [],
      },
    ],
  });
});

test("to string", () => {
  expect(
    ASTNode.from({ start: 0, type: "num", content: "123" }).toString()
  ).toBe("num");

  expect(ASTNode.from({ start: 0, type: "", content: "+" }).toString()).toBe(
    `"+"`
  );
});

test("to tree string", () => {
  const node = new ASTNode({
    type: "exp",
    start: 0,
    children: [
      new ASTNode({ type: "num", start: 0, text: "123" }),
      new ASTNode({ type: "", start: 4, text: "+" }),
      new ASTNode({ type: "num", start: 5, text: "123" }),
    ],
  });

  expect(node.toTreeString()).toBe(
    'exp: \n  num: "123"\n  <anonymous>: "+"\n  num: "123"\n'
  );
});
