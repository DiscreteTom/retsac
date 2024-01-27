import { Lexer } from "../../src";

test("default", () => {
  const pt = new Lexer.PositionTransformer();
  expect(pt.transform(0)).toBe(undefined);
});

test("empty", () => {
  const pt = new Lexer.PositionTransformer("");
  expect(pt.transform(0)).toBe(undefined);
});

test("new lines only", () => {
  const pt = new Lexer.PositionTransformer("\n\n\n");
  expect(pt.transform(0)).toEqual({ line: 1, column: 1 });
  expect(pt.transform(1)).toEqual({ line: 2, column: 1 });
  expect(pt.transform(2)).toEqual({ line: 3, column: 1 });
  expect(pt.transform(3)).toBe(undefined);
});

test("complex", () => {
  const input = "abc\ndef\n123\n345";
  const pt = new Lexer.PositionTransformer(input);
  expect(pt.transform(input.indexOf("a"))).toEqual({ line: 1, column: 1 });
  expect(pt.transform(input.indexOf("c"))).toEqual({ line: 1, column: 3 });
  expect(pt.transform(input.indexOf("\n"))).toEqual({ line: 1, column: 4 });
  expect(pt.transform(input.indexOf("d"))).toEqual({ line: 2, column: 1 });
  expect(pt.transform(input.indexOf("f"))).toEqual({ line: 2, column: 3 });
  expect(pt.transform(input.indexOf("1"))).toEqual({ line: 3, column: 1 });
  expect(pt.transform(input.indexOf("5"))).toEqual({ line: 4, column: 3 });
  expect(pt.transform(input.length)).toBe(undefined);
});
