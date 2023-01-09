import { lexer } from "./lexer-error-handling";

describe("lexer error handling", () => {
  test("unclosed string", () => {
    const token1 = lexer.reset().lex(`"123"`);
    expect(token1!.content).toBe(`"123"`);
    expect(token1!.error).toBeUndefined();

    const token2 = lexer.reset().lex(`"123\n123`);
    expect(token2!.content).toBe(`"123\n`);
    expect(token2!.error).toBe("Unclosed string literal");

    const token3 = lexer.reset().lex(`"123`);
    expect(token3!.content).toBe(`"123`);
    expect(token3!.error).toBe("Unclosed string literal");
  });

  test("invalid number", () => {
    const token1 = lexer.reset().lex(`123`);
    expect(token1!.content).toBe(`123`);
    expect(token1!.error).toBeUndefined();

    const token2 = lexer.reset().lex(`123456`);
    expect(token2!.content).toBe(`123456`);
    expect(token2!.error).toBe("Number is too big");
  });
});
