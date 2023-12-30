import { lexer } from "./lexer-error-handling";

describe("lexer error handling", () => {
  test("unclosed string", () => {
    const token1 = lexer.reset().lex(`"123"`);
    expect(token1!.content).toBe(`"123"`);
    expect(token1!.error).toBeUndefined();

    const token2 = lexer.reset().lex(`"123\n123`);
    expect(token2!.content).toBe(`"123`);
    expect(token2!.error).toBe("unclosed string literal");

    const token3 = lexer.reset().lex(`"123`);
    expect(token3!.content).toBe(`"123`);
    expect(token3!.error).toBe("unclosed string literal");
  });

  test("invalid number", () => {
    const token1 = lexer.reset().lex(`123`);
    expect(token1!.content).toBe(`123`);
    expect(token1!.error).toBeUndefined();

    const token2 = lexer.reset().lex(`12e34e56`);
    expect(token2!.content).toBe(`12e34`);
    expect(token2!.error).toBe("invalid numeric literal");
  });

  test("invalid identifier", () => {
    const token1 = lexer.reset().lex(`abc`);
    expect(token1!.content).toBe(`abc`);
    expect(token1!.error).toBeUndefined();
  });

  test("fallback handler", () => {
    const token1 = lexer.reset().lex(`123#abc`);
    expect(token1!.content).toBe(`123`);
    const token2 = lexer.lex(); // this will ignore `#`
    expect(token2!.content).toBe(`abc`);
  });
});
