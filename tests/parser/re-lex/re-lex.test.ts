import { ELR, Lexer, Logger } from "../../../src";

test("re-lex with expectation", () => {
  const printer = jest.fn();
  const logger = new Logger({ printer });

  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ num: Lexer.javascript.numericLiteral() })
    .anonymous(...Lexer.exactArray("-", "--"))
    .build({
      // debug: true,
      // logger,
    });

  const { parser } = new ELR.AdvancedBuilder()
    .define({ exp: `num ('-' | '--') num` })
    .build({
      lexer,
      entry: "exp",
      debug: true,
      logger,
    });

  // this will try `num '-' num` first, but failed, then re-lex and try `num '--' num`
  expect(parser.parse("1--1").accept).toBe(true);
  expect(printer).toHaveBeenCalledWith(
    '[Parser] try lex: store other possibilities for re-lex:\n<anonymous>: "--"',
  );
  expect(printer).toHaveBeenCalledWith(
    '[Parser] re-lex, restored: "--", trying: ASTNode({ kind: "", start: 1, text: "--", data: undefined, error: undefined })',
  );
});

test("disable re-lex", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ num: Lexer.javascript.numericLiteral() })
    .anonymous(...Lexer.exactArray("-", "--"))
    .build({
      // debug: true,
      // logger,
    });

  const { parser } = new ELR.AdvancedBuilder()
    .define({ exp: `num ('-' | '--') num` })
    .build({
      lexer,
      entry: "exp",
      reLex: false,
      // debug: true,
    });

  expect(parser.parse("1--1").accept).toBe(false);
});
