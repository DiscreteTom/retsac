import { Lexer } from "../../../src";

test("stateful lexer", () => {
  const lexer = new Lexer.Builder()
    .state({ reject: false }) // set action state for the lexer
    .define({
      conditional: (a) =>
        a
          .from(/123/)
          // access state by `input.state`
          // reject the input if `input.state.reject` is `true`
          .reject(({ input }) => input.state.reject)
          // if the action is successfully accepted, set `input.state.reject` to `true`
          .then(({ input }) => (input.state.reject = true)),
    })
    .build();

  // the first lex should be accepted
  // and the state will be changed
  expect(lexer.lex("123")).not.toBe(null);
  // so the second lex should be rejected
  expect(lexer.lex("123")).toBe(null);

  // reset the lexer
  lexer.reset();
  // now the input can be accepted again
  expect(lexer.lex("123")).not.toBe(null);
});
