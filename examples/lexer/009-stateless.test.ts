import { Lexer } from "../../src";

test("stateless lexer", () => {
  // `Lexer` is stateful, it keep tracks of the lexer state (digested, buffer, etc) and the action state.
  // we can use `builder.buildStateless` to get a stateless lexer
  new Lexer.Builder().buildStateless();

  // or use `lexer.stateless()` to get the stateless lexer from a stateful lexer
  const lexer = new Lexer.Builder().ignore(/\s+/).define({ A: /a/ }).build("a");
  const stateless = lexer.stateless;

  // stateless lexer is useful if we only want to
  // lex the head of a input buffer
  // but we need to provide the action state manually
  let res = stateless.lex("aaa", { actionState: undefined as never });
  expect(res.token!.kind).toBe("A");

  // we can also manually provide other details
  res = stateless.lex("aaa", {
    actionState: undefined as never,
    start: 1,
    expect: { kind: "A" },
  });
  expect(res.token!.kind).toBe("A");
  expect(res.token!.range.start).toBe(1);
});
