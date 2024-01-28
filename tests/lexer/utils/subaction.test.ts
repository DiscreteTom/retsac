import { Lexer } from "../../../src";

const input = new Lexer.ActionInput({
  buffer: "123",
  start: 0,
  rest: undefined,
  state: undefined,
});

function expectAccept(sa: Lexer.SubAction<undefined>) {
  const res = sa.exec(input, 0)!;
  expect(res).toBe(3);
}

describe("constructors", () => {
  test("from exec", () => {
    expectAccept(
      Lexer.SubAction.from((input, pos) => input.buffer.length - pos),
    );
  });

  test("from string", () => {
    expectAccept(Lexer.SubAction.from("123"));
  });

  test("from regex", () => {
    expectAccept(Lexer.SubAction.from(/\d+/));
  });
});
