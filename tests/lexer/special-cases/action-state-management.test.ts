import { Lexer } from "../../../src";

test("lexer action state", () => {
  const lexer = new Lexer.Builder()
    .useState({ value: 1 })
    .define({ number: /\d+/ }, (a) =>
      a.then(({ output, input }) => {
        input.state.value += Number(output.content);
      }),
    )
    .build();

  // ensure initial value
  expect(lexer.core.state.value).toBe(1);

  // modify the state
  lexer.lex("123");
  expect(lexer.core.state.value).toBe(124);

  // reset the value
  lexer.reset();
  expect(lexer.core.state.value).toBe(1);

  // clone the lexer
  const clone = lexer.clone();

  // ensure initial value
  expect(clone.core.state.value).toBe(1);

  // modify the state
  clone.lex("123");
  expect(clone.core.state.value).toBe(124);

  // original lexer should not be affected
  expect(lexer.core.state.value).toBe(1);

  // clone with state
  const cloneWithState = clone.clone();
  expect(cloneWithState.core.state.value).toBe(124);

  // dry clone
  const dryClone = clone.dryClone();
  expect(dryClone.core.state.value).toBe(1);

  // peek won't change the state
  expect(lexer.reset().lex({ input: "123", peek: true })).not.toBeNull();
  expect(lexer.core.state.value).toBe(1);
});
