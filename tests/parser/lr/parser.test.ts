import { Lexer, LR, Manager } from "../../../src";
import { ASTNode } from "../../../src/parser";

const lexer = new Lexer.Builder()
  .define({
    number: /^[0-9]+(?:\.[0-9]+)?/,
  })
  .anonymous(Lexer.exact(..."+-*/()"))
  .build();

const parser = new LR.ParserBuilder<number>()
  .entry("exp")
  .define(
    { exp: "number" },
    LR.reducer((_, { matched }) => Number(matched[0].text))
  )
  .define(
    { exp: `exp '+' exp` },
    LR.reducer<number>((values) => values[0]! + values[2]!)
  )
  .build();

test("parse", () => {
  const res = parser
    .reset()
    .parseAll(lexer.lexAll("1+1").map((t) => ASTNode.from(t)));

  expect(res.accept).toBe(true);
  if (res.accept) {
    expect(res.buffer[0].data).toBe(2);
  }
});
