import type { GeneralToken } from "../../src/lexer";
import { ASTNode } from "../../src/parser";

test("from token", () => {
  const node = ASTNode.from({
    content: "123",
    kind: "num",
    start: 0,
    data: undefined,
  });
  expect(node.kind).toBe("num");
  expect(node.start).toBe(0);
  expect(node.text).toBe("123");
  expect(node.children).toBe(undefined);
  expect(node.parent).toBe(undefined);
  expect(node.data).toBe(undefined);
  expect(node.error).toBe(undefined);
});

test("to obj", () => {
  const node1 = ASTNode.from({
    content: "123",
    kind: "num",
    start: 0,
    data: undefined,
  });
  const obj1 = node1.toJSON();

  expect(obj1).toEqual({
    name: "num",
    kind: "num",
    start: 0,
    text: "123",
    children: [],
  });

  const node2 = new ASTNode({
    kind: "exp",
    start: 0,
    children: [node1],
  });
  const obj2 = node2.toJSON();

  expect(obj2).toEqual({
    name: "exp",
    kind: "exp",
    start: 0,
    text: "",
    children: [
      {
        name: "num",
        kind: "num",
        start: 0,
        text: "123",
        children: [],
      },
    ],
  });
});

test("to string", () => {
  expect(
    ASTNode.from({
      start: 0,
      kind: "num",
      content: "123",
      data: undefined,
    }).toString(),
  ).toBe(
    'ASTNode({ kind: "num", start: 0, text: "123", data: undefined, error: undefined })',
  );

  expect(
    ASTNode.from({
      start: 0,
      kind: "",
      content: "+",
      data: undefined,
    }).toString(),
  ).toBe(
    'ASTNode({ kind: "", start: 0, text: "+", data: undefined, error: undefined })',
  );
});

test("to tree string", () => {
  const node = new ASTNode({
    kind: "exp",
    start: 0,
    children: [
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "num",
        start: 0,
        text: "123",
      }),
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "",
        start: 4,
        text: "+",
        name: "plus",
      }),
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "num",
        start: 5,
        text: "123",
      }),
    ],
  });

  expect(node.toTreeString()).toBe(
    'exp: \n  num: "123"\n  <anonymous>@plus: "+"\n  num: "123"\n',
  );
});

test("query selector", () => {
  const node = new ASTNode({
    kind: "exp",
    start: 0,
    children: [
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "num",
        start: 0,
        text: "123",
      }),
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "",
        start: 4,
        text: "+",
        name: "plus",
      }),
      new ASTNode<unknown, unknown, "exp" | "num" | "", GeneralToken>({
        kind: "num",
        start: 5,
        text: "123",
      }),
    ],
  });

  expect(node.$("plus")).toBe(node.children![1]);
  expect(node.$$("num")).toEqual([node.children![0], node.children![2]]);
});
