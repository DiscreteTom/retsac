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
    mutedErr: Action.from(/^muted-error/)
      .check(() => "muted error")
      .mute(),
  })
  .build();

test("lexer basic functions", () => {
  expect(lexer.getRest()).toBe("");
  expect(lexer.feed("123").getRest()).toBe("123");
  expect(lexer.feed("123").hasRest()).toBe(true);
  expect(lexer.feed("123").reset().getRest()).toBe("");
  expect(lexer.feed("123").lex()?.content).toBe("123");
  expect(Array.from(lexer.getTokenTypes()).sort()).toEqual(
    ["", "number", "someErr", "mutedErr"].sort()
  );
});

test("trimStart", () => {
  // trim start
  expect(lexer.reset().trimStart("   123").getRest()).toBe("123");
  // trim start with no input
  expect(lexer.reset().trimStart().getRest()).toBe("");
  // trim start without muted chars at the head of input
  expect(lexer.reset().trimStart("123").getRest()).toBe("123");
  // trim start with error
  expect(lexer.reset().trimStart("muted-error").hasErrors()).toBe(true);
  // trim start with no accept
  expect(lexer.reset().trimStart("aaa").getRest()).toBe("aaa");
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

test("clone & dryClone", () => {
  // give lexer some state
  lexer.reset().lex("\n  1\n123");

  // ensure cloned state is the same as the original
  const lexerClone = lexer.clone();
  expect(lexerClone.getRest()).toBe(lexer.getRest());
  expect(lexer.getPos(5)).toEqual(lexerClone.getPos(5));
  expect(lexer.getErrors()).toEqual(lexerClone.getErrors());

  // ensure cloned state is independent from the original
  lexerClone.reset().lex("123");
  expect(lexerClone.getRest()).not.toBe(lexer.getRest());

  // ensure dryClone is independent from the original
  const lexerDryClone = lexer.dryClone();
  expect(lexerDryClone.getRest()).not.toBe(lexer.getRest());
});

test("expectation", () => {
  // no expectation
  expect(
    lexer.reset().lex({
      input: "123",
    })?.content
  ).toBe("123");

  // wrong type
  expect(
    lexer.reset().lex({
      input: "123",
      expect: {
        type: "",
        text: "+",
      },
    })
  ).toBe(null);

  // wrong text
  expect(
    lexer.reset().lex({
      input: "123",
      expect: {
        text: "1234",
      },
    })
  ).toBe(null);

  // starts with muted, yield token
  expect(
    lexer.reset().lex({
      input: "  123",
      expect: {
        type: "number",
        text: "123",
      },
    })?.content
  ).toBe("123");
});
