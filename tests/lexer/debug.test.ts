import { Lexer, Logger, jsonLoggerFactory } from "../../src";

// TODO: refactor this file, split test cases in different functions
test("lexer debug lex", () => {
  const printer = jest.fn();
  const logger = new Logger({ printer });
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .anonymous(Lexer.exact(..."+-*/()"))
    .define({
      string: (a) => a.from(Lexer.stringLiteral(`'`)).mute(() => false), // set maybe-mute, but do not mute
    })
    .define({
      number: Lexer.javascript.numericLiteral(),
    })
    .define({
      hash: /#/,
    })
    .build({ debug: true, logger });

  lexer.reset();
  expect(printer).toHaveBeenCalledWith("[Lexer.reset]");

  expect(lexer.lex()).toBe(null); // no rest
  expect(printer).toHaveBeenCalledWith("[Lexer.lex] no rest");

  lexer.feed("0123");
  expect(printer).toHaveBeenCalledWith("[Lexer.feed] 4 chars");

  expect(lexer.take(1)).toBe("0");
  expect(printer).toHaveBeenCalledWith('[Lexer.take] 1 chars: "0"');

  expect(
    lexer.lex({ input: "45", expect: { kind: "number", text: "12345" } })
      ?.content,
  ).toBe("12345");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.lex] options: {"expect":{"kind":"number","text":"12345"}}',
  );
  expect(printer).toHaveBeenCalledWith("[Lexer.lex] reject: <anonymous>");
  lexer.reset().lex({ input: "!", expect: { kind: "number" } });
  expect(printer).toHaveBeenCalledWith(
    "[Lexer.lex] skip (unexpected and never muted): hash",
  );
  expect(printer).toHaveBeenCalledWith(
    "[Lexer.lex] skip (unexpected and never muted): <anonymous>",
  );
  expect(printer).toHaveBeenCalledWith("[Lexer.lex] reject: string");
  expect(lexer.lex({ input: `'123'`, expect: { kind: "number" } })).toBe(null); // unexpected

  expect(printer).toHaveBeenCalledWith(
    '[Lexer.lex] accept kind number, 5 chars: "12345"',
  );
  expect(
    lexer
      .reset()
      .lex({ input: `'123'`, expect: { kind: "string", text: "'111'" } }),
  ).toBe(null); // unexpected
  expect(printer).toHaveBeenCalledWith(
    `[Lexer.lex] unexpected string: "'123'"`,
  );

  lexer.reset().lex("+");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.lex] accept kind <anonymous>, 1 chars: "+"',
  );
  lexer.reset().lex(" ");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.lex] accept kind <anonymous>(muted), 1 chars: " "',
  );

  // peek
  lexer.reset().lex({ input: "123", expect: { kind: "number" }, peek: true });
  expect(printer).toHaveBeenCalledWith("[Lexer.lex] peek");
});

test("lexer debug trimStart", () => {
  const printer = jest.fn();
  const logger = new Logger({ printer });
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .anonymous(Lexer.exact("!"))
    .anonymous(Lexer.exact(..."+-*/()").mute(() => false)) // set maybe-mute, but do not mute
    .define({
      string: Lexer.stringLiteral(`'`).mute(() => false), // set maybe-mute, but do not mute
    })
    .define({
      number: Lexer.javascript.numericLiteral().mute(() => false), // set maybe-mute, but do not mute
    })
    .define({
      hash: /#/,
    })
    .build({ debug: true, logger });

  // generate logs
  lexer.reset();
  lexer.trimStart(" 123");

  // check logs
  expect(printer).toHaveBeenCalledWith("[Lexer.reset]");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.trimStart] trim <anonymous>, 1 chars: " "',
  );
  expect(printer).toHaveBeenCalledWith("[Lexer.trimStart] reject: <anonymous>");
  expect(printer).toHaveBeenCalledWith(
    "[Lexer.trimStart] skip (never muted): <anonymous>",
  );
  lexer.reset().trimStart("!");
  expect(printer).toHaveBeenCalledWith(
    "[Lexer.trimStart] skip (never muted): hash",
  );
  expect(printer).toHaveBeenCalledWith("[Lexer.trimStart] reject: string");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.trimStart] found unmuted number, 3 chars: "123"',
  );

  lexer.reset().trimStart("$"); // no accept

  expect(printer).toHaveBeenCalledWith("[Lexer.trimStart] no accept");
});

test("lexer clone with debug", () => {
  const jsonLogger = jsonLoggerFactory();
  const printer = jest.fn();
  const logger = new Logger({ printer });
  const lexer = new Lexer.Builder().build({ debug: true, logger });
  expect(lexer.clone().debug).toBe(true); // inherit debug
  expect(lexer.clone({ debug: false }).debug).toBe(false); // override debug
  expect(lexer.clone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.clone({ logger: jsonLogger }).logger).toBe(jsonLogger); // override logger
  expect(lexer.dryClone().debug).toBe(true); // dry clone also inherit debug
  expect(lexer.dryClone({ debug: true }).debug).toBe(true); // override debug
  expect(lexer.dryClone({ debug: false }).debug).toBe(false); // override debug
  expect(lexer.dryClone({ logger: jsonLogger }).logger).toBe(jsonLogger); // override logger
});

test("lexer debug takeUntil", () => {
  const printer = jest.fn();
  const logger = new Logger({ printer });
  const lexer = new Lexer.Builder().build({ debug: true, logger });

  lexer.reset().feed("123").takeUntil("3");
  expect(printer).toHaveBeenCalledWith(
    '[Lexer.takeUntil] 3 chars with /3/g: "123"',
  );

  lexer.reset().feed("123").takeUntil("4");
  expect(printer).toHaveBeenCalledWith("[Lexer.takeUntil] no match: /4/g");
});
