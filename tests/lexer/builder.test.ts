import { Lexer } from "../../src";

function newBuilder() {
  return new Lexer.Builder()
    .state({ count: 0 })
    .error<string>()
    .ignore(Lexer.whitespaces())
    .define({
      number: /[0-9]+/,
      error: (a) => a.from(/error/).error("error"),
      stateful: (a) =>
        a
          .from(/state/)
          .reject(({ input }) => input.state.count !== 0)
          .then(({ input }) => input.state.count++),
    })
    .anonymous(Lexer.exact(..."+-*/()"));
}

test("builder ignore", () => {
  const lexer = newBuilder().build();
  expect(lexer.reload(" ").lex().token).toBe(undefined);
  expect(lexer.reload("   ").lex().token).toBe(undefined);
});

test("builder define", () => {
  const lexer = newBuilder().build();
  expect(lexer.reload("1").lex().token?.kind).toBe("number");
  expect(lexer.reload("123").lex().token?.kind).toBe("number");
});

test("builder anonymous", () => {
  const lexer = newBuilder().build();
  expect(lexer.reload("+").lex().token?.kind).toBe("");
  expect(lexer.reload("+").lex().token?.content).toBe("+");
});

test("error", () => {
  const lexer = newBuilder().build();
  expect(lexer.reload("error").lex().token?.error).toBe("error");
});

test("stateful", () => {
  const lexer = newBuilder().build();
  expect(lexer.reload("state state").lex().token).not.toBe(undefined);
  expect(lexer.lex().token).toBe(undefined);
});

test("builder define using array", () => {
  const lexer = new Lexer.Builder()
    .define({
      string: [
        Lexer.stringLiteral(`'`),
        Lexer.stringLiteral(`"`),
        Lexer.stringLiteral("`", { multiline: true }),
      ],
    })
    .build();

  expect(lexer.reload(`'abc'`).lex().token?.kind).toBe("string");
  expect(lexer.reload(`"abc"`).lex().token?.kind).toBe("string");
  expect(lexer.reload("`abc`").lex().token?.kind).toBe("string");
});

test("define action with multiple kinds", () => {
  const lexer = new Lexer.Builder()
    .append((a) =>
      a
        .from(/\s+/)
        .kinds("singleWs", "multiWs")
        .select(({ output }) =>
          output.content.length === 1 ? "singleWs" : "multiWs",
        ),
    )
    .build();
  expect(lexer.reload(" ").lex().token?.kind).toBe("singleWs");
  expect(lexer.reload("  ").lex().token?.kind).toBe("multiWs");
});
