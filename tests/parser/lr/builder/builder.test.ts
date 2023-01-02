import { Lexer, LR } from "../../../../src";
import { ASTNode } from "../../../../src/parser";
import { ParserBuilder } from "../../../../src/parser/LR";
import { DefinitionContextBuilder } from "../../../../src/parser/LR/builder/ctx-builder";

const lexer = new Lexer.Builder()
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

test("ParserBuilder basics", () => {
  const mathParser = new LR.ParserBuilder()
    .define({ exp: `exp '-' exp` })
    .define({ exp: `exp '+' exp` });

  const parser = new LR.ParserBuilder()
    .entry("exp")
    .define({ exp: `number` }, new DefinitionContextBuilder({}))
    .use(mathParser)
    .checkSymbols(new Set(["number"]))
    .build();

  const res = parser.parseAll(
    lexer.lexAll("1+1-1").map((t) => ASTNode.from(t))
  );
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(res.buffer[0].toTreeString()).toBe(
      `exp: \n  exp: \n    exp: \n      number: 1\n    <anonymous>: +\n    exp: \n      number: 1\n  <anonymous>: -\n  exp: \n    number: 1\n`
    );
  }
});

test("ParserBuilder simple calculator", () => {
  const mathParser = new LR.ParserBuilder<number>()
    .define(
      { exp: `exp '-' exp` },
      LR.reducer<number>((values) => values[0]! - values[2]!).resolveRS(
        { exp: `exp '+' exp` },
        { next: `'+'` }
      )
    )
    .define(
      { exp: `exp '+' exp` },
      LR.reducer<number>((values) => values[0]! + values[2]!).resolveRS(
        { exp: `exp '-' exp` },
        { next: `'-'` }
      )
    );

  const parser = new LR.ParserBuilder<number>()
    .entry("exp")
    .define(
      { exp: `number` },
      LR.callback((ctx) => (ctx.data = Number(ctx.matched[0].text)))
    )
    .use(mathParser)
    .checkSymbols(new Set(["number"]))
    .build();

  const res = parser.parseAll(
    lexer.lexAll("1+1-1").map((t) => ASTNode.from(t))
  );
  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer.length).toBe(1);
    expect(res.buffer[0].data).toBe(1 + 1 - 1);
  }
});

test("ParserBuilder simple errors", () => {
  expect(() => new ParserBuilder().build()).toThrow(
    `Please set entry NTs for LR Parser.`
  );

  expect(() =>
    new ParserBuilder().define({ exp: `number` }).checkSymbols(new Set())
  ).toThrow(`Undefined grammar symbol: number`);

  expect(() =>
    new ParserBuilder()
      .define({ exp: `number` })
      .checkSymbols(new Set(["exp", "number"]))
  ).toThrow(`Duplicated definition for grammar symbol: exp`);

  expect(() =>
    new ParserBuilder().entry("exp").checkSymbols(new Set())
  ).toThrow(`Undefined entry NT: "exp"`);
});
