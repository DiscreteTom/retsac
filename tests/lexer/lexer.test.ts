import { Lexer } from "../../src";
import type { Token } from "../../src/lexer";
import { InvalidLengthForTakeError } from "../../src/lexer";

function buildLexer() {
  return new Lexer.Builder()
    .error<string>()
    .state({ value: 0 })
    .ignore(Lexer.whitespaces())
    .define({
      number: (a) => a.from(/[0-9]+/).then((ctx) => ctx.input.state.value++),
    })
    .anonymous(Lexer.exact(..."+-*/()"))
    .define({
      someErr: (a) => a.from(/error/).check(() => "some error"),
      mutedErr: (a) =>
        a
          .from(/muted-error/)
          .check(() => "muted error")
          .mute(),
    })
    .build();
}

test("lexer basic functions", () => {
  const lexer = buildLexer();
  expect(lexer.state.rest.value).toBe("");
  expect(lexer.reload("123").state.rest.value).toBe("123");
  expect(lexer.reload("123").state.hasRest()).toBe(true);
  expect(lexer.reload("123").lex().token?.content).toBe("123");
  expect(Array.from(lexer.stateless.getTokenKinds()).sort()).toEqual(
    ["", "number", "someErr", "mutedErr"].sort(),
  );

  // reload will also reset the action state
  expect(lexer.reload("").actionState.value).toBe(0);
  lexer.reload("123").lex();
  expect(lexer.actionState.value).toBe(1);
  lexer.reload("");
  expect(lexer.actionState.value).toBe(0);
});

test("peek", () => {
  const lexer = buildLexer();
  // peek does not consume input
  lexer.reload("123").peek();
  expect(lexer.state.rest.value).toBe("123");

  // peek with multi ignore
  // this is to ensure digestedByPeek is correctly updated
  const newLexer = new Lexer.Builder()
    .ignore(
      Lexer.whitespaces(), // blank
      Lexer.comment("//"), // single line comment
      Lexer.comment("/*", "*/"), // multiline comment
    )
    .anonymous(Lexer.exact("a"))
    .build();
  expect(
    newLexer.reload(" // multiline comment\na").peek(),
  ).not.toBeUndefined();
});

test("trim", () => {
  const lexer = buildLexer();
  // trim start
  lexer.reload("   123").trim();
  expect(lexer.state.rest.value).toBe("123");
  // trim start with no input
  lexer.reload("").trim();
  expect(lexer.state.rest.value).toBe("");
  // trim start without muted chars at the head of input
  lexer.reload("123").trim();
  expect(lexer.state.rest.value).toBe("123");
  // trim start with error
  const res = lexer.reload("muted-error").trim();
  expect(res.errors.length).toBe(1);
  // trim start with no accept
  lexer.reload("aaa").trim();
  expect(lexer.state.rest.value).toBe("aaa");
});

test("lexer take", () => {
  const lexer = buildLexer();
  expect(lexer.reload("123").take(3).state.rest.value).toBe("");
  expect(lexer.state.digested).toBe(3);
  expect(() => lexer.reload("123").take(0)).toThrow(InvalidLengthForTakeError);
  expect(() => lexer.reload("123").take(-1)).toThrow(InvalidLengthForTakeError);

  // take will reset state by default if success
  lexer.reload("123abc").lex();
  expect(lexer.actionState.value).toBe(1);
  expect(() => lexer.take(-1)).toThrow(InvalidLengthForTakeError);
  expect(lexer.actionState.value).toBe(1);
  lexer.take(3);
  expect(lexer.actionState.value).toBe(0);

  // set new action state
  lexer.reload("123abc").lex();
  expect(lexer.actionState.value).toBe(1);
  expect(() => lexer.take(-1, { value: 2 })).toThrow(InvalidLengthForTakeError);
  expect(lexer.actionState.value).toBe(1);
  lexer.take(3, { value: 2 });
  expect(lexer.actionState.value).toBe(2);
});

test("number", () => {
  ["1", "123", "0123", "01230"].forEach((str) => {
    const lexer = buildLexer();
    expect(lexer.reload(str).lex().token).toEqual({
      kind: "number",
      buffer: str,
      range: { start: 0, end: str.length },
      error: undefined,
      data: undefined,
    } as Token<{ kind: "number"; data: never }, never>);
  });
});

test("ignore", () => {
  [" ", "\n", "\r", " \n\r \n\r"].forEach((str) => {
    const lexer = buildLexer();
    expect(lexer.reload(str).lex().token).toBe(undefined);
  });
});

test("anonymous", () => {
  ["+", "-", "*", "/"].forEach((str) => {
    const lexer = buildLexer();
    expect(lexer.reload(str).lex().token).toEqual({
      kind: "",
      buffer: str,
      range: { start: 0, end: str.length },
      error: undefined,
      data: undefined,
    } as Token<{ kind: ""; data: never }, never>);
  });
});

test("lexAll", () => {
  const lexer = buildLexer();
  expect(
    lexer
      .reload("123 123")
      .lexAll()
      .tokens.map((token) => token.content),
  ).toEqual(["123", "123"]);
});

test("expectation", () => {
  const lexer = buildLexer();
  // no expectation
  expect(lexer.reload("123").lex({}).token?.content).toBe("123");

  // wrong type
  expect(
    lexer.reload("123").lex({
      kind: "",
      text: "+",
    }).token,
  ).toBe(undefined);

  // wrong text
  expect(
    lexer.reload("123").lex({
      text: "1234",
    }).token,
  ).toBe(undefined);

  // starts with muted, yield token
  expect(
    lexer.reload("123").lex({
      kind: "number",
      text: "123",
    }).token?.content,
  ).toBe("123");
});
