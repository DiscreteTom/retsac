import { Lexer } from "../../src";

test("maybe muted", () => {
  // there is a field `maybeMuted` in `Action`
  // which will be set if you use `action.mute`
  let action = Lexer.Action.from(/a/);
  // by default `maybeMuted` is `false`
  expect(action.maybeMuted).toBe(false);

  // with `mute`, the `maybeMuted` field will be set by the argument
  action = action.mute();
  expect(action.maybeMuted).toBe(true);
  action = action.mute(false);
  expect(action.maybeMuted).toBe(false);

  // you can also pass a function to determine whether the output is muted
  // but in this case the `maybeMuted` field will always be `true`
  action = action.mute(() => true);
  expect(action.maybeMuted).toBe(true);
  action = action.mute(() => false);
  expect(action.maybeMuted).toBe(true);

  // we can edit the `maybeMuted` field if we know what we are doing
  action.maybeMuted = false;
  expect(action.maybeMuted).toBe(false);
  action.maybeMuted = true;
  expect(action.maybeMuted).toBe(true);
});

test("expectation", () => {
  const lexer = new Lexer.Builder()
    .ignore(/-/)
    .define({
      A: /a/,
      B: /a/,
    })
    .build("-a");

  // by default, the lex will evaluate all actions in the order they are defined
  // so the first token will be A
  let token = lexer.lex().token!;
  expect(token.kind).toBe("A");

  // but if we have an expected kind
  // the lex will only evaluate actions which are bound to the expected kind
  // or maybe-muted actions
  lexer.reload("-a");
  let res = lexer.lex({ kind: "B" });
  token = res.token!;
  expect(token.kind).toBe("B");
  expect(res.digested).toBe(2); // the muted action is also evaluated and digested a character

  // we can also expect a specific text
  lexer.reload("-a");
  res = lexer.lex({ text: "b" });
  expect(res.token).toBeUndefined();
  expect(res.digested).toBe(1); // the muted action is also evaluated and digested a character
  res = lexer.lex({ text: "a" });
  token = res.token!;
  expect(token.kind).toBe("A");

  // or both the text and the kind are expected
  lexer.reload("-a");
  res = lexer.lex({ text: "b", kind: "A" });
  expect(res.token).toBeUndefined();
  res = lexer.lex({ text: "a", kind: "A" });
  token = res.token!;
  expect(token.kind).toBe("A");
});
