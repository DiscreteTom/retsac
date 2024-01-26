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
  expect(lexer.getRest()).toBe("");
  expect(lexer.feed("123").getRest()).toBe("123");
  expect(lexer.feed("123").hasRest()).toBe(true);
  expect(lexer.feed("123").reset().getRest()).toBe("");
  expect(lexer.feed("123").lex()?.content).toBe("123");
  expect(Array.from(lexer.getTokenKinds()).sort()).toEqual(
    ["", "number", "someErr", "mutedErr"].sort(),
  );

  // reset will also reset the action state
  expect(lexer.reset().core.state.value).toBe(0);
  lexer.lex("123");
  expect(lexer.core.state.value).toBe(1);
  lexer.reset();
  expect(lexer.core.state.value).toBe(0);
});

test("lex with peek", () => {
  const lexer = buildLexer();
  // peek does not consume input
  lexer.reset().feed("123").lex({ peek: true });
  expect(lexer.getRest()).toBe("123");
  // by default peek is false
  expect(lexer.reset().lex({ input: "123" })?.content).toBe("123");
  expect(lexer.reset().lex("123")?.content).toBe("123");

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
    newLexer.lex({ input: " // multiline comment\na", peek: true }),
  ).not.toBeNull();
});

test("trimStart", () => {
  const lexer = buildLexer();
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

test("lexer take", () => {
  const lexer = buildLexer();
  expect(lexer.reset().feed("123").take(3)).toBe("123");
  expect(lexer.getRest()).toBe("");
  expect(lexer.digested).toBe(3);
  expect(() => lexer.reset().feed("123").take(0)).toThrow(
    InvalidLengthForTakeError,
  );
  expect(() => lexer.reset().feed("123").take(-1)).toThrow(
    InvalidLengthForTakeError,
  );

  // take will reset state by default if success
  lexer.reset().lex("123");
  expect(lexer.core.state.value).toBe(1);
  expect(() => lexer.take(-1)).toThrow(InvalidLengthForTakeError);
  expect(lexer.core.state.value).toBe(1);
  lexer.feed("123");
  lexer.take(3);
  expect(lexer.core.state.value).toBe(0);

  // set new action state
  lexer.reset().lex("123");
  expect(lexer.core.state.value).toBe(1);
  expect(() => lexer.take(-1, { value: 2 })).toThrow(InvalidLengthForTakeError);
  expect(lexer.core.state.value).toBe(1);
  lexer.feed("123");
  lexer.take(3, { value: 2 });
  expect(lexer.core.state.value).toBe(2);
});

test("lexer takeUntil", () => {
  const lexer = buildLexer();
  expect(lexer.reset().feed("123").takeUntil("3")).toBe("123");
  expect(lexer.reset().feed("123").takeUntil(/3/)).toBe("123");
  expect(lexer.reset().feed("123").takeUntil(/4/)).toBe("");
  expect(lexer.reset().feed("123").takeUntil(/3/g, { autoGlobal: false })).toBe(
    "123",
  );

  // takeUntil will reset state by default if success
  lexer.reset().lex("123");
  expect(lexer.core.state.value).toBe(1);
  lexer.takeUntil("3");
  expect(lexer.core.state.value).toBe(1);
  lexer.feed("123");
  lexer.takeUntil("3");
  expect(lexer.core.state.value).toBe(0);

  // set new action state
  lexer.reset().lex("123");
  expect(lexer.core.state.value).toBe(1);
  lexer.takeUntil("3", { state: { value: 2 } });
  expect(lexer.core.state.value).toBe(1);
  lexer.feed("123");
  lexer.takeUntil("3", { state: { value: 2 } });
  expect(lexer.core.state.value).toBe(2);
});

test("number", () => {
  ["1", "123", "0123", "01230"].forEach((str) => {
    const lexer = buildLexer();
    expect(lexer.reset().lex(str)).toEqual({
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
    expect(lexer.reset().lex(str)).toBe(null);
  });
});

test("anonymous", () => {
  ["+", "-", "*", "/"].forEach((str) => {
    const lexer = buildLexer();
    expect(lexer.reset().lex(str)).toEqual({
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
      .reset()
      .lexAll("123 123")
      .map((token) => token.content),
  ).toEqual(["123", "123"]);
});

test("lexAll with error", () => {
  const lexer = buildLexer();
  // stop on error
  let tokens = lexer.reset().lexAll({ input: "error 123", stopOnError: true });
  expect(tokens.map((token) => token.content)).toEqual(["error"]);
  expect(lexer.errors[0].error).toBe("some error");

  // don't stop on error
  tokens = lexer.reset().lexAll({ input: "error 123" });
  expect(tokens.map((token) => token.content)).toEqual(["error", "123"]);
  expect(lexer.errors[0].error).toBe("some error");
});

test("reset lexer", () => {
  const lexer = buildLexer();
  lexer.lexAll("error 123");
  lexer.reset();
  expect(lexer.hasRest()).toBe(false);
  expect(lexer.hasErrors()).toBe(false);
  expect(lexer.lineChars).toEqual([0]);
});

test("getLineChars & getPos", () => {
  const lexer = buildLexer();
  lexer.reset().feed("123\n12345\n1234567").lexAll();
  expect(lexer.lineChars).toEqual([4, 6, 7]);
  expect(lexer.getPos(0)).toEqual({ line: 1, column: 1 });
  expect(lexer.getPos(1)).toEqual({ line: 1, column: 2 });
  expect(lexer.getPos(3)).toEqual({ line: 1, column: 4 });
  expect(lexer.getPos(4)).toEqual({ line: 2, column: 1 });
  expect(lexer.getPos(9)).toEqual({ line: 2, column: 6 });
  expect(lexer.getPos(16)).toEqual({ line: 3, column: 7 });
});

test("clone & dryClone", () => {
  const lexer = buildLexer();
  // give lexer some state
  lexer.reset().lex("\n  1\n123");

  // ensure cloned state is the same as the original
  const lexerClone = lexer.clone();
  expect(lexerClone.getRest()).toBe(lexer.getRest());
  expect(lexer.getPos(5)).toEqual(lexerClone.getPos(5));
  expect(lexer.errors).toEqual(lexerClone.errors);

  // ensure cloned state is independent from the original
  lexerClone.reset().lex("123");
  expect(lexerClone.getRest()).not.toBe(lexer.getRest());

  // ensure dryClone is independent from the original
  const lexerDryClone = lexer.dryClone();
  expect(lexerDryClone.getRest()).not.toBe(lexer.getRest());
});

test("expectation", () => {
  const lexer = buildLexer();
  // no expectation
  expect(
    lexer.reset().lex({
      input: "123",
    })?.content,
  ).toBe("123");

  // wrong type
  expect(
    lexer.reset().lex({
      input: "123",
      expect: {
        kind: "",
        text: "+",
      },
    }),
  ).toBe(null);

  // wrong text
  expect(
    lexer.reset().lex({
      input: "123",
      expect: {
        text: "1234",
      },
    }),
  ).toBe(null);

  // starts with muted, yield token
  expect(
    lexer.reset().lex({
      input: "  123",
      expect: {
        kind: "number",
        text: "123",
      },
    })?.content,
  ).toBe("123");
});
