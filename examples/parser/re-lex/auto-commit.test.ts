import { ELR, Lexer } from "../../../src";

test("auto commit", () => {
  const lexer = new Lexer.Builder()
    .ignore(Lexer.whitespaces())
    .define({ num: Lexer.javascript.numericLiteral() })
    .anonymous(...Lexer.exactArray("-", "--"))
    .build();

  const { parser } = new ELR.AdvancedBuilder()
    .define({ exp: `num ('-' '-' | '--') num` })
    .build({
      lexer,
      entry: "exp",
    });

  // this will try `num '-' '-' num` first
  // and save `num '--' num` as another possibility
  expect(parser.reset().parse("1--1").accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");
  expect(parser.buffer.length).toBe(1);
  expect(parser.buffer[0].children!.length).toBe(4);
  expect(
    // access the private property
    (parser as unknown as { reLexStack: Array<unknown> })["reLexStack"].length,
  ).toBe(1);

  // enable auto commit
  // you can also enable it when building the parser
  parser.autoCommit = true;
  // now when `parser.parse` is successful
  // the parser will auto commit
  // remove all other possibilities
  expect(parser.reset().parse("1--1").accept).toBe(true);
  expect(parser.lexer.getRest()).toBe("");
  expect(parser.buffer.length).toBe(1);
  expect(parser.buffer[0].children!.length).toBe(4);
  expect(
    // access the private property
    (parser as unknown as { reLexStack: Array<unknown> })["reLexStack"].length,
  ).toBe(0);
});
