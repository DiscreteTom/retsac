import { parser_1, parser_2 } from "./commit";

test("definition context commit", () => {
  const res = parser_1.parseAll("2--1");
  expect(res.accept).toBe(true); // `exp '--' '1'`

  if (res.accept) {
    expect(parser_1.lexer.getRest()).toBe("1"); // `2--` is committed
  }
});

test("definition context commit with function", () => {
  const res = parser_2.parseAll("2--1");
  expect(res.accept).toBe(true); // `exp '--' '1'`

  if (res.accept) {
    expect(parser_2.lexer.getRest()).toBe("1"); // `2--` is committed
  }
});
