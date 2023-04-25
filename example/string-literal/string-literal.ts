import { Lexer } from "../../src";

export const lexer = new Lexer.Builder()
  .ignore(Lexer.whitespaces)
  .define({
    simpleStr: Lexer.stringLiteral(`'`).or(Lexer.stringLiteral(`"`)),
    multilineStr: Lexer.stringLiteral("`", { multiline: true }),
    customQuote: Lexer.stringLiteral(`*`),
    custom: Lexer.stringLiteral(`^`, { close: "$$" }),
  })
  .build();
