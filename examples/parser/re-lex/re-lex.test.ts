import { parser, result } from "./re-lex";

test("re-lex", () => {
  const res = parser.parseAll("1--1");
  expect(res.accept).toBe(true);

  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(parser.lexer.getRest()).toBe("");
  }
});

test("rollback", () => {
  let res = parser.reset().parseAll("1--");
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(parser.lexer.getRest()).toBe("");
  }
  expect(result.value).toBe(1); // callback should be called without rollback

  res = parser.reset().parseAll("1--1"); // re-lex, rollback should be called
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(parser.lexer.getRest()).toBe("");
  }
  expect(result.value).toBe(0);
});
