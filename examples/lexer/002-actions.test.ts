import { Lexer } from "../../src";

test("action orders", () => {
  const lexer = new Lexer.Builder()
    .define({
      // first defined actions have higher priority
      A: /a/,
      B: /a/,
    })
    // different actions can share the same target token kind
    .define({ A: /b/ })
    .build("ab");

  // the first token should be A
  const token = lexer.lex().token!;
  expect(token.kind).toBe("A");

  // the second token should be A as well
  const token2 = lexer.lex().token!;
  expect(token2.kind).toBe("A");
});

test("action decorators", () => {
  let lexer = new Lexer.Builder()
    // set the action state
    .state({ reject: false })
    // set the token's error type
    .error<string>()
    // when using action decorators
    // typescript compiler can't infer the action's generic parameters
    // so we need to use a callback to define actions
    // these callbacks accept a function which takes an `ActionBuilder` as its parameter
    // so the action's generic parameters can be inferred from the `ActionBuilder`
    .define({
      // as a convention, use empty string for muted actions.
      // we can use `ActionBuilder.from` just like `Action.from`.
      // to mute an action, we can use `action.mute`
      "": (_ /* the ActionBuilder */) => _.from(/\s+/).mute(),
      A: (_) =>
        // to set token's error, we can use `check` or `error`
        _.from(/a/).check((ctx) =>
          ctx.output.hasRest() ? "error" : undefined,
        ),
      B: (_) =>
        // to reject an action after the output is yielded, we can use `reject`
        _.from(/b/).reject((ctx) => ctx.output.hasRest()),
      C: (_) =>
        // to reject an action before the output is yielded, we can use `prevent`
        _.from(/c/).prevent((input) => input.state.reject),
      D: (_) =>
        _.from(/d/)
          // use `then` to run a callback if this action is accepted and is not a peek
          // this is usually used to modify lexer's action state
          .then((ctx) => (ctx.input.state.reject = true))
          // yes you can apply multi decorators to an action
          .prevent((input) => input.state.reject),
    })
    .build("a b c");

  // the first lex should be accepted but with error set
  let res = lexer.lex();
  let token = res.token!;
  expect(token.kind).toBe("A");
  expect(token.error).toBe("error");
  expect(res.errors.length).toBe(1);
  expect(res.errors[0]).toBe(token);

  // the second lex should be rejected but still digest some characters
  res = lexer.lex();
  expect(res.token).toBeUndefined();
  expect(res.digested).toBe(1); // digest one whitespace
  expect(res.errors.length).toBe(0); // no new error

  // create a new lexer with the same actions and a new input
  lexer = lexer.clone({ buffer: "c d c" });

  // the first lex should be accepted as C
  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("C");
  expect(token.error).toBeUndefined();
  expect(token.range.start).toBe(0);
  expect(token.range.end).toBe(1);

  // the second lex should be accepted and will change the state
  res = lexer.lex();
  token = res.token!;
  expect(token.kind).toBe("D");
  expect(token.range.start).toBe(2);
  expect(token.range.end).toBe(3);
  expect(lexer.actionState.reject).toBe(true);

  // the third lex should be rejected
  res = lexer.lex();
  expect(res.token).toBeUndefined();
});
