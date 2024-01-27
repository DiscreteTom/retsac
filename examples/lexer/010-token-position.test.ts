import { Lexer } from "../../src";

test("token position", () => {
  // for a better performance, lexer doesn't keep track of the position of each token.
  // token is ephemeral, it has information about the index of the buffer when it is created.

  // to get the position of a token (instead of an index)
  // we can use PositionTransformer
  const text = "123\n123\n";
  const pt = new Lexer.PositionTransformer(text);
  const lexer = new Lexer.Builder()
    .ignore(/\n/)
    .define({ A: /123/ })
    .build(text);

  const peek = lexer.peek();
  const token = peek.token!;

  // use `transform` to get the position from the index
  // it will use binary search to find the line index
  const pos = pt.transform(token.range.start)!;
  expect(pos.line).toBe(1);
  expect(pos.column).toBe(1);

  // however, if we want to batch transform the positions of all tokens
  // calling `transform` for each token is not efficient
  // we can get the line ranges and calculate them by ourselves
  expect(pt.lineRanges.length).toBe(3);
  expect(pt.lineRanges[0]).toEqual({ start: 0, end: 4 });
  expect(pt.lineRanges[1]).toEqual({ start: 4, end: 8 });
  expect(pt.lineRanges[2]).toEqual({ start: 8, end: 8 });
});
