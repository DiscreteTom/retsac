import { Lexer } from "../../../src";

const input = new Lexer.ActionInput({
  buffer: "123",
  start: 0,
  peek: false,
  rest: undefined,
  state: undefined,
});

function expectAccept(sa: Lexer.SubAction<undefined>) {
  const res = sa.exec(input, 0) as Lexer.AcceptedSubActionOutput;
  expect(res.accept).toBe(true);
  expect(res.digested).toBe(3);
}

describe("constructors", () => {
  test("from exec", () => {
    expectAccept(
      Lexer.SubAction.from((input, pos) => {
        return { accept: true, digested: input.buffer.length - pos };
      }),
    );
  });

  test("from string", () => {
    expectAccept(Lexer.SubAction.from("123"));
  });

  test("from regex", () => {
    expectAccept(Lexer.SubAction.from(/\d+/));
  });
});
