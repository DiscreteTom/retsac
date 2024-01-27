import { Lexer } from "../../src";

test("stateful lexer", () => {
  const lexer = new Lexer.Builder()
    .state(
      // set the default action state
      { reject: false },
      // set the action state cloner
      // if this is omitted, the state will be cloned by structuredClone
      (state) => ({ ...state }),
    )
    .define({
      A: (a) =>
        a
          .from(/123/)
          // access lexer's action state by `input.state`
          .prevent((input) => input.state.reject)
          // if the action is accepted, set the state's `reject` field to `true`.
          .then((ctx) => (ctx.input.state.reject = true)),
    })
    .build("123123");

  // by default `state.reject` is `false`
  expect(lexer.actionState.reject).toBe(false);

  // the first lex should be accepted
  let res = lexer.lex();
  let token = res.token!;
  expect(token.kind).toBe("A");

  // and the action state will be changed
  expect(lexer.actionState.reject).toBe(true);

  // the second lex should be rejected
  res = lexer.lex();
  expect(res.token).toBeUndefined();

  // besides, you can set the action_state directly
  lexer.actionState.reject = false;
  expect(lexer.actionState.reject).toBe(false);
  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("A");
});
