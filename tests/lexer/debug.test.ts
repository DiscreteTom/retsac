import { Lexer } from "../../src";

test("prepare lexer log", () => {
  // const logger = jest.fn();
  const logger = console.log;
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces)
    .define({
      string: Lexer.stringLiteral(`'`),
      number: Lexer.numericLiteral(),
    })
    .build({ debug: true, logger });

  // generate logs
  lexer.reset();
  expect(lexer.lex()).toBe(null); // no rest
  lexer.feed("0123");
  expect(lexer.take(1)).toBe("0");
  expect(
    lexer.lex({ input: "45", expect: { type: "number", text: "12345" } })
      ?.content
  ).toBe("12345");

  expect(logger).toHaveBeenCalledWith("[Lexer.reset]");
  expect(logger).toHaveBeenCalledWith("[Lexer.lex] no rest");
  expect(logger).toHaveBeenCalledWith("[Lexer.feed] 4 chars");
  expect(logger).toHaveBeenCalledWith('[Lexer.take] 1 chars: "0"');
  expect(logger).toHaveBeenCalledWith(
    '[Lexer.lex] expect "{\\"type\\":\\"number\\",\\"text\\":\\"12345\\"}"'
  );
  expect(logger).toHaveBeenCalledWith("[Lexer.lex] rejected:");
});

test("lexer clone with debug", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder().build({ debug: true, logger });
  expect(lexer.clone().debug).toBe(true); // inherit debug
  expect(lexer.clone({ debug: false }).debug).toBe(false); // override debug
  expect(lexer.clone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.dryClone().debug).toBe(false); // dry clone
  expect(lexer.dryClone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.dryClone({ debug: false }).debug).toBe(false); // override debug
});
