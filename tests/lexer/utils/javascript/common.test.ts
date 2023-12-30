import { Lexer } from "../../../../src";

test("javascript comment", () => {
  const lexer = new Lexer.Builder()
    .define({
      comment: Lexer.javascript.comment(),
    })
    .build();

  // single line
  expect(lexer.reset().lex("// abc\n")?.content).toBe("// abc\n");
  expect(lexer.reset().lex("// abc\n// def")?.content).toBe("// abc\n");

  // multi line
  expect(lexer.reset().lex("/* abc */")?.content).toBe("/* abc */");
  expect(lexer.reset().lex("/* abc\n*/")?.content).toBe("/* abc\n*/");
  expect(lexer.reset().lex("/* abc\n*/\n")?.content).toBe("/* abc\n*/");

  // unclosed
  expect(lexer.reset().lex("// abc")?.content).toBe("// abc");
  expect(lexer.reset().lex("/* abc")?.content).toBe("/* abc");
});

describe("javascript identifier", () => {
  const lexer = new Lexer.Builder()
    .define({
      identifier: Lexer.javascript.identifier(),
    })
    .build();

  test("alphabetic", () => {
    expect(lexer.reset().lex("abc")?.content).toBe("abc");
  });

  test("alphabetic with number", () => {
    expect(lexer.reset().lex("abc123")?.content).toBe("abc123");
  });

  test("starts with number", () => {
    expect(lexer.reset().lex("123abc")).toBe(null);
  });

  test("$ and _", () => {
    expect(lexer.reset().lex("$abc")?.content).toBe("$abc");
    expect(lexer.reset().lex("_abc")?.content).toBe("_abc");
  });

  test("unicode", () => {
    expect(lexer.reset().lex("中文")?.content).toBe("中文");
  });
});
