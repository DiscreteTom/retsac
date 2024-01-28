import { Lexer } from "../../../src";

test("lexer action state", () => {
  const lexer = new Lexer.Builder()
    .state({ value: 1 })
    .define({
      number: (a) =>
        a.from(/\d+/).then(({ output, input }) => {
          input.state.value += Number(output.content);
        }),
    })
    .build();

  // ensure initial value
  expect(lexer.actionState.value).toBe(1);

  // modify the state
  lexer.reload("123").lex();
  expect(lexer.actionState.value).toBe(124);

  // reset the value
  lexer.reload("");
  expect(lexer.actionState.value).toBe(1);

  // clone the lexer
  const clone = lexer.clone();

  // ensure initial value
  expect(clone.actionState.value).toBe(1);

  // modify the state
  clone.reload("123").lex();
  expect(clone.actionState.value).toBe(124);

  // original lexer should not be affected
  expect(lexer.actionState.value).toBe(1);

  // clone with state
  const cloneWithState = clone.clone();
  expect(cloneWithState.actionState.value).toBe(124);

  // clone with new buffer (dryClone) will reset the state
  const dryClone = clone.clone({ buffer: "1" });
  expect(dryClone.actionState.value).toBe(1);

  // peek won't change the state
  const peek = lexer.reload("123").peek();
  expect(peek.token).not.toBeUndefined();
  expect(peek.actionState.value).toBe(124);
  expect(lexer.actionState.value).toBe(1);
});
