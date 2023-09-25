import { ELR, Lexer } from "../../../src";

test("re-lex with expectation", () => {
  const logger = jest.fn();

  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ num: Lexer.numericLiteral() })
    .anonymous(...Lexer.exactArray("-", "--"))
    .build({
      // debug: true,
      // logger,
    });

  const { parser } = new ELR.AdvancedBuilder()
    .define({ exp: `num ('-' | '--') num` })
    .entry("exp")
    .build({
      lexer,
      debug: true,
      logger,
    });

  // this will try `num '-' num` first, but failed, then re-lex and try `num '--' num`
  expect(parser.parse("1--1").accept).toBe(true);
  expect(logger).toHaveBeenCalledWith(
    '[Re-Lex] Restored input: "--" Trying: ASTNode({ kind: "", start: 1, text: "--", data: undefined, error: undefined })',
  );
});

test("disable re-lex", () => {
  const logger = jest.fn();

  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ num: Lexer.numericLiteral() })
    .anonymous(...Lexer.exactArray("-", "--"))
    .build({
      // debug: true,
      // logger,
    });

  const { parser } = new ELR.AdvancedBuilder()
    .define({ exp: `num ('-' | '--') num` })
    .entry("exp")
    .build({
      lexer,
      reLex: false,
      debug: true,
      logger,
    });

  expect(parser.parse("1--1").accept).toBe(false);
});
