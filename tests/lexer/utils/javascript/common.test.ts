import { Lexer } from "../../../../src";

test("javascript comment", () => {
  const lexer = new Lexer.Builder()
    .define({
      comment: Lexer.javascript.comment(),
    })
    .build();

  // single line
  expect(lexer.reload("// abc\n").lex().token?.content).toBe("// abc\n");
  expect(lexer.reload("// abc\n// def").lex().token?.content).toBe("// abc\n");

  // multi line
  expect(lexer.reload("/* abc */").lex().token?.content).toBe("/* abc */");
  expect(lexer.reload("/* abc\n*/").lex().token?.content).toBe("/* abc\n*/");
  expect(lexer.reload("/* abc\n*/\n").lex().token?.content).toBe("/* abc\n*/");

  // unclosed
  expect(lexer.reload("// abc").lex().token?.content).toBe("// abc");
  expect(lexer.reload("/* abc").lex().token?.content).toBe("/* abc");
});

describe("javascript identifier", () => {
  const lexer = new Lexer.Builder()
    .define({
      identifier: Lexer.javascript.identifier(),
    })
    .build();

  test("alphabetic", () => {
    expect(lexer.reload("abc").lex().token?.content).toBe("abc");
  });

  test("alphabetic with number", () => {
    expect(lexer.reload("abc123").lex().token?.content).toBe("abc123");
  });

  test("starts with number", () => {
    expect(lexer.reload("123abc").lex().token).toBe(undefined);
  });

  test("$ and _", () => {
    expect(lexer.reload("$abc").lex().token?.content).toBe("$abc");
    expect(lexer.reload("_abc").lex().token?.content).toBe("_abc");
  });

  test("unicode", () => {
    expect(lexer.reload("中文").lex().token?.content).toBe("中文");
  });
});
