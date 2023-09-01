import { Lexer } from "../../src";

test("lexer debug lex", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .anonymous(Lexer.exact(..."+-*/()"))
    .define({
      hash: /#/,
      string: Lexer.stringLiteral(`'`).mute(() => false), // set maybe-mute, but do not mute
      number: Lexer.numericLiteral(),
    })
    .build({ debug: true, logger });

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

  lexer.reset().lex({ input: "123", expect: { type: "number" } });
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.lex] skip <anonymous> (unexpected and never muted)"
  );

  lexer.reset().lex("+");
  expect(logger).toHaveBeenCalledWith('[Lexer.lex] accept <anonymous>: "+"');
  lexer.reset().lex(" ");
  expect(logger).toHaveBeenCalledWith(
    '[Lexer.lex] accept <anonymous>(muted): " "'
  );
});

test("lexer debug trimStart", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .anonymous(Lexer.exact("!"))
    .anonymous(Lexer.exact(..."+-*/()").mute(() => false)) // set maybe-mute, but do not mute
    .define({
      hash: /#/,
      string: Lexer.stringLiteral(`'`).mute(() => false), // set maybe-mute, but do not mute
      number: Lexer.numericLiteral().mute(() => false), // set maybe-mute, but do not mute
    })
    .build({ debug: true, logger });

  // generate logs
  lexer.reset();
  lexer.trimStart(" 123");
  lexer.reset().trimStart("$"); // no accept

  // check logs
  expect(logger).toHaveBeenCalledWith("[Lexer.reset]");
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.trimStart] skip <anonymous> (never muted)"
  );
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

  lexer.reset().trimStart("+");
  expect(logger).toHaveBeenCalledWith(
    "[Lexer.trimStart] not muted: <anonymous>, stop trimming"
  );
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

test("lexer debug takeUntil", () => {
  const logger = jest.fn();
  const lexer = new Lexer.Builder().build({ debug: true, logger });

  lexer.reset().feed("123").takeUntil("3");
  expect(logger).toHaveBeenCalledWith('[Lexer.takeUntil] 3 chars: "123"');
});
