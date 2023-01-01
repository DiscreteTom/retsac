import { Lexer } from "../../src";
import { Action } from "../../src/lexer";
import { Token } from "../../src/lexer/model";

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
  expect(Array.from(lexer.getTokenTypes())).toEqual(["", "number", "someErr"]);
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
  expect(
    lexer
      .reset()
      .lexAll("error 123", true)
      .map((token) => token.content)
  ).toEqual(["error"]);
});
