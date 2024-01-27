import { Lexer } from "../../src";

test("lexer basics", () => {
  // create a lexer via the lexer builder
  const lexer = new Lexer.Builder()
    // you can use `ignore` to define a muted action
    // which will be accepted during the lexing process
    // without yielding any token
    .ignore(
      // we can create actions from a regex pattern
      // remember NOT to use `^` at the beginning of the pattern
      // because lexer will make the regex `global` and use `lastIndex`
      // to match the input from the current position
      /\s+/,
    )
    // for not muted actions, we can use `define` to define them in an object
    // the key is the target token's kind name
    // the value is the action source
    .define({
      // we can use `Action.from` or `Action.simple` to create an action with a closure
      // the closure's return value indicates how many characters are digested by the action
      // `0` means the action is rejected
      A: Lexer.Action.from((input) =>
        input.buffer[input.start] === "a" ? 1 : 0,
      ),
      // we can also use a regex directly to create an action, or `Action.from(RegExp)`
      B: /b/,
      // if you want to control more details about the action's output
      // like the `error` field and the `muted` field
      // you can use `Action.exec` to create an action
      // the closure should directly return an `ActionOutput | undefined`
      // however this is NOT the simplest way to modify the action
      // we will introduce a simpler way in `002-actions.test.ts`
      C: Lexer.Action.exec((input) =>
        input.buffer[input.start] === "c"
          ? {
              digested: 1,
              muted: false,
              data: undefined,
            }
          : undefined,
      ),
    })
    // load the input string
    .build("a b c");

  // the first token should be A
  const token = lexer.lex().token!;
  expect(token.kind).toBe("A");
  expect(token.range.start).toBe(0);
  expect(token.range.end).toBe(1);
  expect(token.content).toBe("a");
  expect(token.data).toBeUndefined();
  expect(token.error).toBeUndefined();

  // the second token should be B
  // because whitespace is muted and ignored
  // no token will be yielded for it
  const token2 = lexer.lex().token!;
  expect(token2.kind).toBe("B");
  expect(token2.range.start).toBe(2);
  expect(token2.range.end).toBe(3);
  expect(token2.content).toBe("b");
  expect(token2.data).toBeUndefined();
  expect(token2.error).toBeUndefined();

  // the third token should be C
  const token3 = lexer.lex().token!;
  expect(token3.kind).toBe("C");
  expect(token3.range.start).toBe(4);
  expect(token3.range.end).toBe(5);
  expect(token3.content).toBe("c");
  expect(token3.data).toBeUndefined();
  expect(token3.error).toBeUndefined();
});
