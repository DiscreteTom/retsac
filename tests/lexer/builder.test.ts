import { Lexer } from "../../src";

function newBuilder() {
  return new Lexer.Builder()
    .state({ count: 0 })
    .error<string>()
    .ignore((a) => a.from(Lexer.whitespaces()))
    .define({
      number: /[0-9]+/,
      error: (a) => a.from(/error/).error("error"),
      stateful: (a) =>
        a
          .from(/state/)
          .reject(({ input }) => input.state.count !== 0)
          .then(({ input }) => input.state.count++),
    })
    .anonymous((a) => a.from(Lexer.exact(..."+-*/()")));
}

test("builder ignore", () => {
  const lexer = newBuilder().build();
  expect(lexer.reset().lex(" ")).toBe(null);
  expect(lexer.reset().lex("   ")).toBe(null);
});

test("builder define", () => {
  const lexer = newBuilder().build();
  expect(lexer.reset().lex("1")?.kind).toBe("number");
  expect(lexer.reset().lex("123")?.kind).toBe("number");
});

test("builder anonymous", () => {
  const lexer = newBuilder().build();
  expect(lexer.reset().lex("+")?.kind).toBe("");
  expect(lexer.reset().lex("+")?.content).toBe("+");
});

test("error", () => {
  const lexer = newBuilder().build();
  expect(lexer.reset().lex("error")?.error).toBe("error");
});

test("stateful", () => {
  const lexer = newBuilder().build();
  expect(lexer.lex("state")).not.toBe(null);
  expect(lexer.lex("state")).toBe(null);
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

  expect(lexer.reset().lex(`'abc'`)?.kind).toBe("string");
  expect(lexer.reset().lex(`"abc"`)?.kind).toBe("string");
  expect(lexer.reset().lex("`abc`")?.kind).toBe("string");
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
  expect(lexer.reset().lex(" ")?.kind).toBe("singleWs");
  expect(lexer.reset().lex("  ")?.kind).toBe("multiWs");
});
