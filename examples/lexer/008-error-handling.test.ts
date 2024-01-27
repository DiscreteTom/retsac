import { Lexer } from "../../src";

test("error tokens", () => {
  const lexer = new Lexer.Builder()
    // we can specify the error type by `builder.error`
    // this is acceptable errors, the lexing process won't stop
    .error<string>()
    .ignore((a) =>
      a
        .from(/\s+/)
        // set error by using `error`
        .error("ignored"),
    )
    .define({
      A: (a) =>
        // set error by using `check`
        a.from(/a/).check((ctx) => (ctx.output.hasRest() ? "end" : undefined)),
    })
    .build(" a");

  // when `lex`, `peek` or `trim`, we can get error tokens from the output
  const res = lexer.lex();
  const token = res.token!;
  expect(token.kind).toBe("A");
  expect(token.error).toBe("end");
  expect(res.errors.length).toBe(2); // the first error is the ignored token
  expect(res.errors[0].kind).toBe("");
  expect(res.errors[0].error).toBe("ignored");
  expect(res.errors[1]).toBe(token);
});

test("panic mode", () => {
  // for some unacceptable errors, we can use panic mode
  // which will digest 1 char and try again
  const lexer = new Lexer.Builder()
    .ignore(/\s+/)
    .define({ A: /a/ })
    .build("b a");

  // in this case when we peek the lexer
  // the 'b' is not accepted by any action
  // and the peek will fail
  let peek = lexer.peek();
  expect(peek.token).toBeUndefined();
  expect(peek.digested).toBe(0); // nothing is digested

  // enter panic mode, take 1 char and try again
  // this will reset the lexer's action state, unless we provide a new state
  lexer.take(1);
  // now we can peek
  peek = lexer.peek();
  expect(peek.token!.kind).toBe("A");
  expect(peek.digested).toBe(2); // the space is also digested
});
