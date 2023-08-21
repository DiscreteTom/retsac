import { Lexer } from "../../src";

test("lexer debug lex", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces)
    .define({
      hash: /#/,
      string: Lexer.stringLiteral(`'`).mute(() => false), // set maybe-mute, but do not mute
      number: Lexer.numericLiteral(),
    })
    .build({ debug: true, logger });

  // generate logs
  lexer.reset();
  expect(logger).toHaveBeenCalledWith("[Lexer.reset]");

  expect(lexer.lex()).toBe(null); // no rest
  expect(logger).toHaveBeenCalledWith("[Lexer.lex] no rest");

  lexer.feed("0123");
  expect(logger).toHaveBeenCalledWith("[Lexer.feed] 4 chars");

  expect(lexer.take(1)).toBe("0");
  expect(logger).toHaveBeenCalledWith('[Lexer.take] 1 chars: "0"');

  expect(
    lexer.lex({ input: "45", expect: { type: "number", text: "12345" } })
      ?.content
  ).toBe("12345");
  expect(logger).toHaveBeenCalledWith(
    '[Lexer.lex] expect {"type":"number","text":"12345"}'
  );
  expect(logger).toHaveBeenCalledWith("[Lexer.lex] rejected: <anonymous>");
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.lex] skip hash (unexpected and never muted)"
  );
  expect(logger).toHaveBeenCalledWith("[Lexer.lex] rejected: string");
  expect(lexer.lex({ input: `'123'`, expect: { type: "number" } })).toBe(null); // unexpected

  expect(logger).toHaveBeenCalledWith('[Lexer.lex] accept number: "12345"');
  expect(logger).toHaveBeenCalledWith(
    '[Lexer.lex] unexpected: {"type":"string","content":"\'123\'"}'
  );
});

test("lexer debug trimStart", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces)
    .define({
      hash: /#/,
      string: Lexer.stringLiteral(`'`).mute(() => false), // set maybe-mute, but do not mute
      number: Lexer.numericLiteral().mute(() => false),
    })
    .build({ debug: true, logger });

  // generate logs
  lexer.reset();
  lexer.trimStart(); // no rest
  lexer.trimStart(" 123");
  lexer.reset().trimStart("$"); // no accept

  // check logs
  expect(logger).toHaveBeenCalledWith("[Lexer.reset]");
  expect(logger).toHaveBeenCalledWith("[Lexer.trimStart] no rest");
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.trimStart] skip hash (never muted)"
  );
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.trimStart] not muted: number, stop trimming"
  );
  expect(logger).toHaveBeenCalledWith(
    '[Lexer.trimStart] trim: <anonymous> content: " "'
  );
  expect(logger).toHaveBeenCalledWith("[Lexer.trimStart] rejected: string");
  expect(logger).toHaveBeenCalledWith("[Lexer.trimStart] no accept");
});

test("lexer clone with debug", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder().build({ debug: true, logger });
  expect(lexer.clone().debug).toBe(true); // inherit debug
  expect(lexer.clone({ debug: false }).debug).toBe(false); // override debug
  expect(lexer.clone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.clone({ logger: console.log }).logger).toBe(console.log); // override logger
  expect(lexer.dryClone().debug).toBe(true); // dry clone also inherit debug
  expect(lexer.dryClone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.dryClone({ debug: false }).debug).toBe(false); // override debug
  expect(lexer.dryClone({ logger: console.log }).logger).toBe(console.log); // override logger
});
