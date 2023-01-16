import { Lexer } from "../../src";
import { Action, Token } from "../../src/lexer";

const lexer = new Lexer.Builder()
  .ignore(/^\s/)
  .define({
    number: /^[0-9]+/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .define({
    someErr: Action.from(/^error/).check(() => "some error"),
  })
  .build();

test("lexer functions", () => {
  expect(lexer.getRest()).toBe("");
  expect(lexer.feed("123").getRest()).toBe("123");
  expect(lexer.feed("123").hasRest()).toBe(true);
  expect(lexer.feed("123").reset().getRest()).toBe("");
  expect(Array.from(lexer.getTokenTypes()).sort()).toEqual(
    ["", "number", "someErr"].sort()
  );
});

test("number", () => {
  ["1", "123", "0123", "01230"].forEach((str) => {
    expect(lexer.reset().lex(str)).toEqual({
      type: "number",
      content: str,
      start: 0,
      error: undefined,
    } as Token);
  });
});

test("ignore", () => {
  [" ", "\n", "\r", " \n\r \n\r"].forEach((str) => {
    expect(lexer.reset().lex(str)).toBe(null);
  });
});

test("anonymous", () => {
  ["+", "-", "*", "/"].forEach((str) => {
    expect(lexer.reset().lex(str)).toEqual({
      type: "",
      content: str,
      start: 0,
      error: undefined,
    } as Token);
  });
});

test("lexAll", () => {
  expect(
    lexer
      .reset()
      .lexAll("123 123")
      .map((token) => token.content)
  ).toEqual(["123", "123"]);
});

test("lexAll with error", () => {
  const tokens = lexer.reset().lexAll("error 123", true);

  expect(tokens.map((token) => token.content)).toEqual(["error"]);
  expect(lexer.getErrors()[0].error).toBe("some error");
});

test("reset lexer", () => {
  lexer.lexAll("error 123");
  lexer.reset();
  expect(lexer.hasRest()).toBe(false);
  expect(lexer.hasErrors()).toBe(false);
  expect(lexer.getLineChars()).toEqual([0]);
});

test("getLineChars & getPos", () => {
  lexer.reset().feed("123\n12345\n1234567").lexAll();
  expect(lexer.getLineChars()).toEqual([4, 6, 7]);
  expect(lexer.getPos(0)).toEqual({ line: 1, column: 1 });
  expect(lexer.getPos(1)).toEqual({ line: 1, column: 2 });
  expect(lexer.getPos(3)).toEqual({ line: 1, column: 4 });
  expect(lexer.getPos(4)).toEqual({ line: 2, column: 1 });
  expect(lexer.getPos(9)).toEqual({ line: 2, column: 6 });
  expect(lexer.getPos(16)).toEqual({ line: 3, column: 7 });
});
